import { type FilePart, generateText, type TextPart } from "ai";
import { model, REPLY_OPTIONS } from "#/ai/model";
import { cleanReply } from "#/ai/prompt";

export const BEST_OF = 4;

const JUDGE_SYSTEM = `You pick the best reply for "Guttasjefen", a rude, overconfident regular in a Norwegian Discord group chat of friends. Rudeness is expected and is never a reason to rule a reply out.

First, for each reply, write one line with a verdict:
- "misread" if it gets the last message wrong: who has what, who wants what, who asked for what, or what happened. Check this literally against the message.
- "bit" if it reads like a comedy bit or a random non sequitur instead of a real person typing, or if it announces its own mood.
- "obvious" if it makes sense but is the comeback anyone would say.
- "good" if it makes sense and is sharper or more surprising, about this message specifically.

Then pick the one a friend in the chat would actually laugh at: a "good" one if there is any, otherwise an "obvious" one. Never pick a "misread".

Answer in exactly this format and nothing else:
1: <verdict>
2: <verdict>
...
best: <number>`;

export type Candidate = { reply: string; finishReason: string };

export async function generateCandidates(
	system: string,
	content: (TextPart | FilePart)[],
	count = BEST_OF,
	temperature: number = REPLY_OPTIONS.temperature,
): Promise<Candidate[]> {
	const results = await Promise.allSettled(
		Array.from({ length: count }, () =>
			generateText({
				model,
				...REPLY_OPTIONS,
				temperature,
				system,
				messages: [{ role: "user", content }],
			}),
		),
	);
	const done = results.filter((r) => r.status === "fulfilled");
	if (done.length === 0) throw (results[0] as PromiseRejectedResult).reason;
	return done.map(({ value }) => ({
		reply: cleanReply(value.text) ?? "",
		finishReason: value.finishReason,
	}));
}

export async function generateCandidatesTogether(
	system: string,
	content: (TextPart | FilePart)[],
	temperature: number = REPLY_OPTIONS.temperature,
): Promise<Candidate[]> {
	const { text, finishReason } = await generateText({
		model,
		...REPLY_OPTIONS,
		maxOutputTokens: REPLY_OPTIONS.maxOutputTokens * 2,
		temperature,
		system,
		messages: [{ role: "user", content }],
	});
	const numbered = text
		.replace(/<\|[^|]*\|>[\s\S]*$/, "")
		.split("\n")
		.map((line) => line.match(/^\s*\d+[.):]\s*(.+)$/)?.[1])
		.map((line) => (line ? cleanReply(line) : undefined))
		.filter((reply): reply is string => Boolean(reply));
	const replies = numbered.length ? numbered : [cleanReply(text) ?? ""];
	return replies.map((reply) => ({ reply, finishReason }));
}

export async function pickBest(
	replies: string[],
	context: { transcript: string; name: string; content: string },
) {
	if (replies.length <= 1) return 0;
	const numbered = replies.map((r, i) => `${i + 1}. ${r}`).join("\n");
	try {
		const { text } = await generateText({
			model,
			temperature: 0,
			maxOutputTokens: 100,
			system: JUDGE_SYSTEM,
			prompt: `Chatlogg:\n${context.transcript}\n\nSiste melding, fra ${context.name}: ${context.content}\n\nSvar å velge mellom:\n${numbered}`,
		});
		const picked = Number(text.match(/best:\s*(\d+)/i)?.[1]);
		return picked >= 1 && picked <= replies.length ? picked - 1 : 0;
	} catch (error) {
		console.error("Picking the best reply failed:", error);
		return 0;
	}
}
