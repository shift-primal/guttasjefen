import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	describeTaste,
	hasStrongLengthDial,
	loadTags,
	pickExamples,
	strongDials,
	type Taste,
} from "#/ai/taste";
import { CONFIG_DIR, EXAMPLES_PER_REPLY } from "#/config/ai";
import {
	EXAMPLES_SECTION_HEADER,
	getReplyLength,
	STRONG_DIALS_INSTRUCTION,
	TASTE_SECTION_HEADER,
	USER_PROMPT_INSTRUCTIONS,
} from "#/config/prompts";
import { poolEntries, readOptional } from "#/helpers/fs";
import { pickRandom } from "#/helpers/random";
import { formatExample } from "#/helpers/text";

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
		: pickRandom(entries, EXAMPLES_PER_REPLY);
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
