import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { generateText } from "ai";
import { refuse } from "#/commands/guards";
import { hasRole } from "#/helpers/discord";
import { readOptional } from "#/helpers/fs";
import { pickRandom } from "#/helpers/random";
import { parseJsonObject } from "#/helpers/text";
import {
	COMMON_WORDS,
	DEV_ROLE,
	LORE_PATH,
	LORE_SHOWN,
	LORE_UPDATE_MAX_TOKENS,
	model,
	PERSONALITY_CONFIG_DIR,
} from "#/personality/config";
import { words } from "#/personality/filters";
import { LORE_UPDATE_SYSTEM } from "#/personality/prompts";
import type { Command, CommandContext } from "#/types";

// "Nils" → "kompis fra bærum, flytta til oslo", plus "meg" for facts about itself
export type Lore = Record<string, string>;

const SELF = "meg";

export async function loadLore(): Promise<Lore> {
	try {
		return JSON.parse(await readFile(LORE_PATH, "utf8"));
	} catch {
		return {};
	}
}

async function saveLore(lore: Lore) {
	await mkdir(dirname(LORE_PATH), { recursive: true });
	await writeFile(LORE_PATH, `${JSON.stringify(lore, null, "\t")}\n`);
}

export async function forgetLore(key: string) {
	const lore = await loadLore();
	const found = Object.keys(lore).find(
		(k) => k.toLowerCase() === key.toLowerCase(),
	);
	if (!found) return null;
	delete lore[found];
	await saveLore(lore);
	return found;
}

// Words that point at an entry: its name, and the rarer words in its notes ("bærum")
function markers(key: string, notes: string) {
	const fromKey = [...words(key)].filter((w) => w.length >= 3);
	const fromNotes = [...words(notes)].filter(
		(w) => w.length >= 5 && !COMMON_WORDS.has(w),
	);
	return [...fromKey, ...fromKey, ...fromNotes];
}

// "meg" always, then the entries the chat mentions most, then random ones to fill up
export function selectLore(lore: Lore, text: string, limit = LORE_SHOWN) {
	const said = words(text);
	const entries = Object.entries(lore).filter(([key]) => key !== SELF);
	const scored = pickRandom(entries, entries.length)
		.map(([key, notes]) => ({
			key,
			notes,
			score: markers(key, notes).filter((w) => said.has(w)).length,
		}))
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);
	const self = lore[SELF];
	return [
		...(self ? [{ key: SELF, notes: self }] : []),
		...scored.map(({ key, notes }) => ({ key, notes })),
	];
}

function formatEntries(entries: { key: string; notes: string }[]) {
	return entries.map(({ key, notes }) => `- ${key}: ${notes}`).join("\n");
}

// Its life for the prompt: lore.md as written, then what it has made up since
export async function describeLore(
	text: string,
	configDir = PERSONALITY_CONFIG_DIR,
) {
	const [seed, lore] = await Promise.all([
		readOptional(join(configDir, "lore.md")),
		loadLore(),
	]);
	const learned = formatEntries(selectLore(lore, text));
	return [seed.trim(), learned].filter(Boolean).join("\n\n");
}

// One at a time, so two replies close together can't overwrite each other's facts
let updates = Promise.resolve();

export function updateLore(context: string, reply: string) {
	updates = updates.then(() => learnFrom(context, reply));
	return updates;
}

async function learnFrom(context: string, reply: string) {
	try {
		const lore = await loadLore();
		const shown = selectLore(lore, `${context} ${reply}`);
		const others = Object.keys(lore).filter(
			(key) => !shown.some((entry) => entry.key === key),
		);
		const known = [
			formatEntries(shown) || "(ingenting ennå)",
			others.length ? `Andre nøkler som finnes: ${others.join(", ")}` : "",
		]
			.filter(Boolean)
			.join("\n");

		const { text } = await generateText({
			model,
			temperature: 0,
			maxOutputTokens: LORE_UPDATE_MAX_TOKENS,
			system: LORE_UPDATE_SYSTEM,
			prompt: `Kjent om livet hans:\n${known}\n\nChatten:\n${context}\n\nSvaret han nettopp sendte: ${reply}`,
		});

		const found = parseJsonObject(text) as Record<string, unknown>;
		// A string adds or updates an entry, null removes one that just got renamed
		const changes = Object.entries(found).filter(
			(entry): entry is [string, string | null] =>
				entry[1] === null ||
				(typeof entry[1] === "string" && Boolean(entry[1].trim())),
		);
		if (changes.length === 0) return;

		const latest = await loadLore();
		for (const [key, notes] of changes) {
			if (notes === null) {
				delete latest[key.trim()];
				console.log(`[lore] ${key.trim()} removed`);
			} else {
				latest[key.trim()] = notes.trim();
				console.log(`[lore] ${key.trim()}: ${notes.trim()}`);
			}
		}
		await saveLore(latest);
	} catch (error) {
		console.error("Lore update failed:", error);
	}
}

// Leaves room under Discord's 2000 characters for the header and footer
const LIST_LIMIT = 1700;

async function run(ctx: CommandContext) {
	if (!hasRole(ctx.member, DEV_ROLE)) {
		return refuse(ctx, `Only the **${DEV_ROLE}** role can use the lore.`);
	}

	const [action, ...rest] = ctx.args.split(/\s+/).filter(Boolean);
	if (action) {
		const key = rest.join(" ");
		if (action.toLowerCase() !== "forget" || !key) {
			return refuse(ctx, "Usage: `lore` or `lore forget <name>`.");
		}
		const forgotten = await forgetLore(key);
		return ctx.reply(
			forgotten
				? `Forgot **${forgotten}**.`
				: `Nothing called "${key}" in the lore.`,
		);
	}

	const entries = Object.entries(await loadLore());
	const lines: string[] = [];
	let length = 0;
	for (const [key, notes] of entries) {
		const line = `**${key}**: ${notes}`;
		if (length + line.length > LIST_LIMIT) break;
		lines.push(line);
		length += line.length + 1;
	}
	const hidden = entries.length - lines.length;
	await ctx.reply(
		[
			`🧠 **Its life so far** · ${entries.length} made up while chatting, plus lore.md`,
			...lines,
			hidden ? `…and ${hidden} more in ${LORE_PATH}` : "",
			"-# `lore forget <name>` removes one",
		]
			.filter(Boolean)
			.join("\n"),
	);
}

export const lore: Command = {
	name: "lore",
	description: `Show the life the AI has made up for itself (${DEV_ROLE} role only)`,
	argument: {
		name: "action",
		description: `"forget <name>" removes something from it (empty lists it all)`,
	},
	run,
};
