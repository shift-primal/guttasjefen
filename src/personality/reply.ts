import { type FilePart, generateText, type TextPart } from "ai";
import { pickRandom } from "#/helpers/random";
import {
	BEST_OF,
	INSULT_TAIL_CHANCE,
	JUDGE_MAX_TOKENS,
	JUDGE_TEMPERATURE,
	model,
	REPLY_OPTIONS,
} from "#/personality/config";
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
import {
	JUDGE_CLAIM_NOTE,
	JUDGE_LORE_LABEL,
	JUDGE_STRONG_DIALS_LABEL,
	JUDGE_SYSTEM,
} from "#/personality/prompts";

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
		maxOutputTokens: REPLY_OPTIONS.maxOutputTokens * BEST_OF,
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
	const allowTail = Math.random() < INSULT_TAIL_CHANCE;
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
		? `${JUDGE_LORE_LABEL}\n${context.lore}\n\n${JUDGE_CLAIM_NOTE(context.acceptClaims)}\n\n`
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
			prompt: `Chatlogg:\n${context.transcript}${context.people}\n\n${lore}${recent}${strong}Siste melding, fra ${context.name}: ${context.content}\n\nSvar å velge mellom:\n${numbered}`,
		});
		const picked = Number(text.match(/best:\s*(\d+)/i)?.[1]);
		return picked >= 1 && picked <= replies.length ? picked - 1 : 0;
	} catch (error) {
		console.error("Picking the best reply failed:", error);
		return 0;
	}
}
