import { escapeMarkdown } from "discord.js";
import { COMMON_WORDS, OPENER_WORDS } from "#/config/ai";

export function words(text: string): Set<string> {
	return new Set(text.toLowerCase().match(/[\p{L}\d]+/gu) ?? []);
}

export function reusedWords(
	reply: string,
	recent: string[],
	others: string,
	commonWords: Set<string> = COMMON_WORDS,
): string[] {
	const own = words(recent.join(" "));
	const theirs = words(others);
	return [...words(reply)].filter(
		(w) => w.length >= 4 && !commonWords.has(w) && own.has(w) && !theirs.has(w),
	);
}

function opener(text: string, count = OPENER_WORDS): string {
	return (text.toLowerCase().match(/[\p{L}\d]+/gu) ?? [])
		.slice(0, count)
		.join(" ");
}

export function sharesOpener(reply: string, past: string[]): boolean {
	const start = opener(reply);
	return start.includes(" ") && past.some((p) => opener(p) === start);
}

const PREPOSITIONS = new Set(
	"i på med til fra av for om hos mot under over etter ved uten".split(" "),
);

const TAIL_FILLERS = new Set(
	"igjen da eller nå også heller lenger altså liksom engang".split(" "),
);

export function hasInsultTail(reply: string): boolean {
	const w = reply.toLowerCase().match(/[\p{L}\d-]+/gu) ?? [];
	for (let tail = 1; tail <= 3; tail++) {
		const i = w.length - tail - 1;
		const before = w[i - 1];
		if (i >= 1 && ["din", "ditt", "dine"].includes(w[i] as string))
			return (
				!PREPOSITIONS.has(before as string) &&
				// "bursdagen din igjen" is just a possessive
				!/^\p{L}{2,}(en|et|a|ene)$/u.test(before as string) &&
				!w.slice(i + 1).some((x) => TAIL_FILLERS.has(x))
			);
	}
	return false;
}

export function cleanReply(text: string): string {
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

export function formatExample(entry: string): string {
	const [message, reply] = entry.split("→").map((part) => part.trim());
	return reply ? `- ${message} → ${reply}` : `- ${entry}`;
}

export function escapeLabel(text: string): string {
	return escapeMarkdown(text).replace(/[[\]]/g, "\\$&");
}

export function parseJsonObject(text: string): unknown {
	return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}
