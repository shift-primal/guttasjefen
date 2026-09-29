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
