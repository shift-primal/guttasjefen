import { changeLore, forgetLore, type Lore, loadLore } from "@guttasjefen/db";
import { generateText } from "ai";
import { refuse } from "#/commands/guards";
import { personality, prompts, tunables } from "#/config/settings";
import { db } from "#/db";
import { hasRole } from "#/helpers/discord";
import { pickRandom } from "#/helpers/random";
import { parseJsonObject } from "#/helpers/text";
import { chatModel } from "#/personality/config";
import { words } from "#/personality/filters";
import type { Command, CommandContext } from "#/types";

const SELF = "meg";

// Words that point at an entry: its name, and the rarer words in its notes ("bærum")
function markers(key: string, notes: string) {
	const fromKey = [...words(key)].filter((w) => w.length >= 3);
	const common = new Set(tunables().words.common);
	const fromNotes = [...words(notes)].filter(
		(w) => w.length >= 5 && !common.has(w),
	);
	return [...fromKey, ...fromKey, ...fromNotes];
}

// "meg" always, then the entries the chat mentions most, then random ones to fill up
export function selectLore(
	lore: Lore,
	text: string,
	limit = tunables().lore.shown,
) {
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
export async function describeLore(text: string) {
	const seed = personality().lore;
	const lore = await loadLore(db);
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
		const lore = await loadLore(db);
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
			model: chatModel(),
			temperature: 0,
			maxOutputTokens: tunables().lore.updateMaxTokens,
			system: prompts().loreUpdateSystem,
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

		const trimmed = changes.map(([key, notes]): [string, string | null] => [
			key.trim(),
			notes?.trim() ?? null,
		]);
		await changeLore(db, trimmed);
		for (const [key, notes] of trimmed) {
			console.log(
				notes === null ? `[lore] ${key} removed` : `[lore] ${key}: ${notes}`,
			);
		}
	} catch (error) {
		console.error("Lore update failed:", error);
	}
}

// Leaves room under Discord's 2000 characters for the header and footer
const LIST_LIMIT = 1700;

async function run(ctx: CommandContext) {
	if (!hasRole(ctx.member, tunables().commands.devRole)) {
		return refuse(
			ctx,
			`Only the **${tunables().commands.devRole}** role can use the lore.`,
		);
	}

	const [action, ...rest] = ctx.args.split(/\s+/).filter(Boolean);
	if (action) {
		const key = rest.join(" ");
		if (action.toLowerCase() !== "forget" || !key) {
			return refuse(ctx, "Usage: `lore` or `lore forget <name>`.");
		}
		const forgotten = await forgetLore(db, key);
		return ctx.reply(
			forgotten
				? `Forgot **${forgotten}**.`
				: `Nothing called "${key}" in the lore.`,
		);
	}

	const entries = Object.entries(await loadLore(db));
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
			hidden ? `…and ${hidden} more` : "",
			"-# `lore forget <name>` removes one",
		]
			.filter(Boolean)
			.join("\n"),
	);
}

export const lore: Command = {
	name: "lore",
	description: "Show the life the AI has made up for itself (dev role only)",
	argument: {
		name: "action",
		description: `"forget <name>" removes something from it (empty lists it all)`,
	},
	run,
};
