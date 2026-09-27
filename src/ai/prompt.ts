import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const CONFIG_DIR = "config";
const EXAMPLES_PER_REPLY = 3;
const MOOD_MIN_MS = 30 * 60_000;
const MOOD_MAX_MS = 120 * 60_000;
export const OWN_REPLY_PLACEHOLDER = "[ditt svar, skjult]";

export type SystemPrompt = { text: string; mood?: string; moodName?: string };

const moods = new Map<string, { mood: string; until: number }>();

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

function currentMood(moodKey: string, pool: string[]) {
	const existing = moods.get(moodKey);
	if (existing && existing.until > Date.now() && pool.includes(existing.mood))
		return existing.mood;
	const [mood] = pickRandom(pool, 1);
	if (mood) {
		const duration = MOOD_MIN_MS + Math.random() * (MOOD_MAX_MS - MOOD_MIN_MS);
		moods.set(moodKey, { mood, until: Date.now() + duration });
	}
	return mood;
}

export async function buildSystem(
	profiles: string,
	moodKey: string,
	configDir = CONFIG_DIR,
): Promise<SystemPrompt> {
	const [persona, rules, moodPool, examples] = await Promise.all([
		readFile(join(configDir, "persona.md"), "utf8"),
		readFile(join(configDir, "chat-rules.md"), "utf8"),
		readOptional(join(configDir, "moods.txt")),
		readOptional(join(configDir, "examples.txt")),
	]);

	const mood = currentMood(moodKey, poolEntries(moodPool));
	const shown = pickRandom(poolEntries(examples), EXAMPLES_PER_REPLY);

	const examplesSection = shown.length
		? `## Example exchanges\n\nFor the vibe only. Never reuse their words, jokes or topics.\n\n${shown.map(formatExample).join("\n")}`
		: "";

	const text = [persona.trim(), rules.trim() + profiles, examplesSection]
		.filter(Boolean)
		.join("\n\n");

	return { text, mood, moodName: mood?.split(":")[0] };
}

export function buildUserPrompt(
	transcript: string,
	name: string,
	content: string,
	mood?: string,
	count = 1,
) {
	const instruction =
		count > 1
			? `Skriv ${count} ulike svar, nummerert 1 til ${count}, ett per linje, uten navn eller tidsstempel. Hvert svar skal ta en helt annen vinkel på meldingen, ikke bare si det samme med andre ord.`
			: "Skriv kun svaret ditt, én linje, uten navn eller tidsstempel foran.";
	return [
		`Chatlogg:\n${transcript}`,
		`Du svarer nå ${name}. Meldingen deres: ${content}`,
		mood &&
			`Humøret ditt i dag (farger tonen, men ikke nevn det eller gjør et nummer ut av det): ${mood}`,
		instruction,
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
