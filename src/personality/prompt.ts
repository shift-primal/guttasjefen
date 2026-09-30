import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG_DIR } from "#/config/bot";
import { readOptional } from "#/helpers/fs";
import { pickRandom } from "#/helpers/random";
import { DIAL_LIMIT, EXAMPLES_PER_REPLY } from "#/personality/config";
import {
	EXAMPLES_SECTION_HEADER,
	getReplyLength,
	STRONG_DIALS_INSTRUCTION,
	TASTE_SECTION_HEADER,
	USER_PROMPT_INSTRUCTIONS,
} from "#/personality/prompts";
import {
	clampDial,
	describeTaste,
	hasStrongLengthDial,
	loadTags,
	strongDials,
	type Tags,
	type Taste,
} from "#/personality/taste";

// One "message → reply" per line in examples.txt and disliked.txt, # for comments
export function poolEntries(text: string): string[] {
	return text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith("#"));
}

// The message half of "message → reply", so two replies to the same message count as one
function exampleMessage(entry: string): string {
	const [message] = entry.split("→");
	return (message ?? entry).trim().toLowerCase();
}

function formatExample(entry: string): string {
	const [message, reply] = entry.split("→").map((part) => part.trim());
	return reply ? `- ${message} → ${reply}` : `- ${entry}`;
}

// Random examples, never two replies to the same message
function pickDistinct(entries: string[], count: number) {
	const seen = new Set<string>();
	return pickRandom(entries, entries.length)
		.filter((entry) => {
			const message = exampleMessage(entry);
			if (seen.has(message)) return false;
			seen.add(message);
			return true;
		})
		.slice(0, count);
}

function weight(tags: Record<string, number>, taste: Taste) {
	let distance = 0;
	for (const [name, { value }] of Object.entries(taste.dials)) {
		const tagged = tags[name];
		const pull = Math.abs(clampDial(value)) / DIAL_LIMIT;
		if (tagged !== undefined) distance += pull * (tagged - value) ** 2;
	}
	return Math.exp(-distance / 2);
}

// Random examples weighted toward the ones tagged closest to the current dials
function pickExamples(
	entries: string[],
	tags: Tags,
	taste: Taste,
	count: number,
): string[] {
	const weights = entries.map((e) => {
		const t = tags[e];
		return t ? weight(t, taste) : undefined;
	});
	const tagged = weights.filter((w) => w !== undefined);
	const fallback = tagged.length
		? tagged.reduce((sum, w) => sum + w, 0) / tagged.length
		: 1;
	const pool = entries.map((entry, i) => ({
		entry,
		weight: weights[i] ?? fallback,
	}));

	const picked: string[] = [];
	while (picked.length < count && pool.length) {
		const total = pool.reduce((sum, p) => sum + p.weight, 0);
		const roll = Math.random() * total;
		let index = 0;
		for (let sum = 0; index < pool.length - 1; index++) {
			sum += pool[index]?.weight ?? 0;
			if (sum >= roll) break;
		}
		const chosen = pool[index];
		if (!chosen) break;
		picked.push(chosen.entry);
		// Never two replies to the same message in one prompt
		const message = exampleMessage(chosen.entry);
		for (let i = pool.length - 1; i >= 0; i--) {
			if (exampleMessage((pool[i] as { entry: string }).entry) === message)
				pool.splice(i, 1);
		}
	}
	return picked;
}

export async function buildSystem(
	profiles: string,
	taste: Taste | null,
	configDir = CONFIG_DIR,
) {
	const [persona, rules, examples, tags] = await Promise.all([
		readFile(join(configDir, "persona.md"), "utf8"),
		readFile(join(configDir, "chat-rules.md"), "utf8"),
		readOptional(join(configDir, "examples.txt")),
		loadTags(configDir),
	]);

	const entries = poolEntries(examples);
	const shown = taste
		? pickExamples(entries, tags, taste, EXAMPLES_PER_REPLY)
		: pickDistinct(entries, EXAMPLES_PER_REPLY);
	const tasteText = describeTaste(taste);
	const tasteSection = tasteText
		? `${TASTE_SECTION_HEADER}\n\n${tasteText}`
		: "";

	const examplesSection = shown.length
		? `${EXAMPLES_SECTION_HEADER}\n\n${shown.map(formatExample).join("\n")}`
		: "";

	return [
		persona.trim(),
		rules.trim() + profiles,
		tasteSection,
		examplesSection,
	]
		.filter(Boolean)
		.join("\n\n");
}

export function buildUserPrompt(
	transcript: string,
	name: string,
	content: string,
	count = 1,
	taste: Taste | null = null,
) {
	const instruction =
		count > 1
			? USER_PROMPT_INSTRUCTIONS.multi(count)
			: USER_PROMPT_INSTRUCTIONS.single;
	const strong = strongDials(taste);
	return [
		`Chatlogg:\n${transcript}`,
		`Du svarer nå ${name}. Meldingen deres: ${content}`,
		hasStrongLengthDial(taste)
			? ""
			: `Lengde denne gangen: ${getReplyLength(content)}.`,
		instruction,
		strong.length ? STRONG_DIALS_INSTRUCTION(strong, count) : "",
	]
		.filter(Boolean)
		.join("\n\n");
}
