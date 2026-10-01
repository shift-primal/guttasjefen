import { type FilePart, generateText, type TextPart } from "ai";
import { prompts, tunables } from "#/config/settings";
import { pickRandom } from "#/helpers/random";
import { chatModel } from "#/personality/config";
import {
	asksForFact,
	asksSomething,
	dodges,
	hasInsultTail,
	reusedWords,
	sharesOpener,
	startsWithYesNo,
	talksAbout,
} from "#/personality/filters";

export type Candidate = { reply: string; finishReason: string };

function cleanReply(text: string): string {
	return (
		text
			.replace(/<\|[^|]*\|>[\s\S]*$/, "")
			.trim()
			.split("\n")[0]
			?.replace(/^\[\d{2}:\d{2}\]\s*/, "")
			.replace(/^Guttasjefen( \(deg\))?:\s*/i, "")
			.trim() ?? ""
	);
}

export async function generateCandidates(
	system: string,
	content: (TextPart | FilePart)[],
	count = tunables().reply.bestOf,
	temperature = tunables().reply.temperature,
): Promise<Candidate[]> {
	const results = await Promise.allSettled(
		Array.from({ length: count }, () =>
			generateText({
				model: chatModel(),
				maxOutputTokens: tunables().reply.maxOutputTokens,
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
	temperature = tunables().reply.temperature,
): Promise<Candidate[]> {
	const { text, finishReason } = await generateText({
		model: chatModel(),
		maxOutputTokens: tunables().reply.maxOutputTokens * tunables().reply.bestOf,
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
	// Hitting the token cap cuts the last reply off mid-sentence
	if (finishReason === "length" && numbered.length > 1) numbered.pop();
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
	lore: string;
	acceptClaims: boolean;
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
	const allowTail = Math.random() < tunables().reply.insultTailChance;
	const tails = allowTail ? fresh : keep(fresh, hasInsultTail);
	// "hva heter han?" → "nei han heter per"
	const facts = asksForFact(context.content)
		? keep(tails, startsWithYesNo)
		: tails;
	const answers = asksSomething(context.content) ? keep(facts, dodges) : facts;
	const filtered = keep(answers, (r) => talksAbout(r, context.name));
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
	const lore = context.lore
		? `${prompts().judgeLoreLabel}\n${context.lore}\n\n${context.acceptClaims ? prompts().judgeClaimAccept : prompts().judgeClaimReject}\n\n`
		: "";
	const strong = context.strongDials.length
		? `${prompts().judgeStrongDialsLabel}\n${context.strongDials.map((d) => `- ${d}`).join("\n")}\n\n`
		: "";
	try {
		const { text } = await generateText({
			model: chatModel(),
			temperature: tunables().reply.judgeTemperature,
			maxOutputTokens: tunables().reply.judgeMaxTokens,
			system: prompts().judgeSystem,
			prompt: `Chatlogg:\n${context.transcript}${context.people}\n\n${lore}${recent}${strong}Siste melding, fra ${context.name}: ${context.content}\n\nSvar å velge mellom:\n${numbered}`,
		});
		const picked = Number(text.match(/best:\s*(\d+)/i)?.[1]);
		return picked >= 1 && picked <= replies.length ? picked - 1 : 0;
	} catch (error) {
		console.error("Picking the best reply failed:", error);
		return 0;
	}
}
