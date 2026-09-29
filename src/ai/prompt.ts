import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG_DIR, EXAMPLES_PER_REPLY } from "#/config/ai";
import {
	EXAMPLES_SECTION_HEADER,
	getReplyLength,
	USER_PROMPT_INSTRUCTIONS,
} from "#/config/prompts";
import { poolEntries, readOptional } from "#/helpers/fs";
import { pickRandom } from "#/helpers/random";
import { formatExample } from "#/helpers/text";

export async function buildSystem(profiles: string, configDir = CONFIG_DIR) {
	const [persona, rules, examples] = await Promise.all([
		readFile(join(configDir, "persona.md"), "utf8"),
		readFile(join(configDir, "chat-rules.md"), "utf8"),
		readOptional(join(configDir, "examples.txt")),
	]);

	const shown = pickRandom(poolEntries(examples), EXAMPLES_PER_REPLY);

	const examplesSection = shown.length
		? `${EXAMPLES_SECTION_HEADER}\n\n${shown.map(formatExample).join("\n")}`
		: "";

	return [persona.trim(), rules.trim() + profiles, examplesSection]
		.filter(Boolean)
		.join("\n\n");
}

export function buildUserPrompt(
	transcript: string,
	name: string,
	content: string,
	count = 1,
) {
	const instruction =
		count > 1
			? USER_PROMPT_INSTRUCTIONS.multi(count)
			: USER_PROMPT_INSTRUCTIONS.single;
	return [
		`Chatlogg:\n${transcript}`,
		`Du svarer nå ${name}. Meldingen deres: ${content}`,
		`Lengde denne gangen: ${getReplyLength(content)}.`,
		instruction,
	].join("\n\n");
}
