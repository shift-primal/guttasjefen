import { type FilePart, generateText, type TextPart } from "ai";
import { model } from "#/ai/model";
import {
	BEST_OF,
	INSULT_TAIL_CHANCE,
	JUDGE_MAX_TOKENS,
	JUDGE_TEMPERATURE,
	REPLY_OPTIONS,
} from "#/config/ai";
import { JUDGE_STRONG_DIALS_LABEL, JUDGE_SYSTEM } from "#/config/prompts";
import { pickRandom } from "#/helpers/random";
import {
	cleanReply,
	hasInsultTail,
	reusedWords,
	sharesOpener,
} from "#/helpers/text";

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
		reply: cleanReply(value.text),
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
	const replies = numbered.length ? numbered : [cleanReply(text)];
	return replies.map((reply) => ({ reply, finishReason }));
}

type JudgeContext = {
	transcript: string;
	name: string;
	content: string;
	recent: string[];
	others: string;
	people: string;
	strongDials: string[];
};

export async function pickBest(
	replies: string[],
	context: JudgeContext & { past: string[] },
) {
	const keep = (indices: number[], drop: (r: string) => boolean) => {
		const kept = indices.filter((i) => !drop(replies[i] as string));
		return kept.length ? kept : indices;
	};
	const fresh = keep(
		replies.map((_, i) => i),
		(r) => sharesOpener(r, context.past),
	);
	const allowTail = Math.random() < INSULT_TAIL_CHANCE;
	const filtered = allowTail ? fresh : keep(fresh, hasInsultTail);
	const pool = pickRandom(filtered, filtered.length);
	const picked = await judge(
		pool.map((i) => replies[i] as string),
		context,
	);
	return pool[picked] ?? 0;
}

async function judge(replies: string[], context: JudgeContext) {
	if (replies.length <= 1) return 0;
	const reused = replies.map((r) =>
		reusedWords(r, context.recent, context.others),
	);
	const tag = reused.some((words) => words.length === 0);
	const numbered = replies
		.map(
			(r, i) =>
				`${i + 1}. ${r}${tag && reused[i]?.length ? ` (gjentar: ${reused[i].join(", ")})` : ""}`,
		)
		.join("\n");
	const recent = context.recent.length
		? `Guttasjefens siste svar:\n${context.recent.map((r) => `- ${r}`).join("\n")}\n\n`
		: "";
	const strong = context.strongDials.length
		? `${JUDGE_STRONG_DIALS_LABEL}\n${context.strongDials.map((d) => `- ${d}`).join("\n")}\n\n`
		: "";
	try {
		const { text } = await generateText({
			model,
			temperature: JUDGE_TEMPERATURE,
			maxOutputTokens: JUDGE_MAX_TOKENS,
			system: JUDGE_SYSTEM,
			prompt: `Chatlogg:\n${context.transcript}${context.people}\n\n${recent}${strong}Siste melding, fra ${context.name}: ${context.content}\n\nSvar å velge mellom:\n${numbered}`,
		});
		const picked = Number(text.match(/best:\s*(\d+)/i)?.[1]);
		return picked >= 1 && picked <= replies.length ? picked - 1 : 0;
	} catch (error) {
		console.error("Picking the best reply failed:", error);
		return 0;
	}
}
