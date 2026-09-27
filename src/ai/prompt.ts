import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const CONFIG_DIR = "config";
const EXAMPLES_PER_REPLY = 3;
export const OWN_REPLY_PLACEHOLDER = "[ditt svar, skjult]";

export type SystemPrompt = { text: string; move?: string; moveName?: string };

async function readOptional(path: string) {
	try {
		return await readFile(path, "utf8");
	} catch {
		return "";
	}
}

function poolEntries(text: string) {
	return text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith("#"));
}

function pickRandom<T>(items: T[], count: number) {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
	}
	return copy.slice(0, count);
}

function formatExample(entry: string) {
	const [message, reply] = entry.split("→").map((part) => part.trim());
	return reply ? `- ${message} → ${reply}` : `- ${entry}`;
}

export async function buildSystem(
	profiles: string,
	configDir = CONFIG_DIR,
): Promise<SystemPrompt> {
	const [persona, rules, moves, examples] = await Promise.all([
		readFile(join(configDir, "persona.md"), "utf8"),
		readFile(join(configDir, "chat-rules.md"), "utf8"),
		readOptional(join(configDir, "moves.txt")),
		readOptional(join(configDir, "examples.txt")),
	]);

	const [move] = pickRandom(poolEntries(moves), 1);
	const shown = pickRandom(poolEntries(examples), EXAMPLES_PER_REPLY);

	const examplesSection = shown.length
		? `## Example exchanges\n\nFor the vibe only. Never reuse their words, jokes or topics.\n\n${shown.map(formatExample).join("\n")}`
		: "";

	const text = [persona.trim(), rules.trim() + profiles, examplesSection]
		.filter(Boolean)
		.join("\n\n");

	return { text, move, moveName: move?.split(":")[0] };
}

export function buildUserPrompt(
	transcript: string,
	name: string,
	content: string,
	move?: string,
) {
	return [
		`Chatlogg:\n${transcript}`,
		`Du svarer nå ${name}. Meldingen deres: ${content}`,
		move &&
			`Trekket ditt denne gangen: ${move}\nPasser det overhodet ikke, gjør noe annet, bare ikke det du pleier.`,
		"Skriv kun svaret ditt, én linje, uten navn eller tidsstempel foran.",
	]
		.filter(Boolean)
		.join("\n\n");
}

export function cleanReply(text: string) {
	return text
		.replace(/<\|[^|]*\|>[\s\S]*$/, "")
		.trim()
		.split("\n")[0]
		?.replace(/^\[\d{2}:\d{2}\]\s*/, "")
		.replace(/^Guttasjefen( \(deg\))?:\s*/i, "")
		.trim();
}
