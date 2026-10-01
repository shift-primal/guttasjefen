import { rename } from "node:fs/promises";
import { join } from "node:path";
import {
	addExamples,
	changeLore,
	loadExamples,
	loadLore,
	loadProfiles,
	readStoredSetting,
	saveProfiles,
	writeSetting,
} from "@guttasjefen/db";
import {
	dialOverridesSchema,
	type SettingKey,
	type SettingValue,
	tagsSchema,
	tasteSchema,
} from "@guttasjefen/db/settings";
import { z } from "zod";
import { db } from "#/db";
import { readOptional, rootPath } from "#/helpers/fs";

const CONFIG = rootPath("config/personality");
const DATA = rootPath("data");
const COOKIES = rootPath("config/music/cookies.txt");

const loreSchema = z.record(z.string(), z.string());
const profilesSchema = z.record(
	z.string(),
	z.object({ name: z.string(), notes: z.string() }),
);

async function readJson<T>(path: string, schema: z.ZodType<T>) {
	const text = await readOptional(path);
	if (!text) return null;
	try {
		return schema.parse(JSON.parse(text));
	} catch (error) {
		console.error(`[import] Skipping invalid ${path}:`, error);
		return null;
	}
}

const lines = (text: string) =>
	text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith("#"));

async function markImported(path: string) {
	await rename(path, `${path}.imported`).catch((error) =>
		console.error(`[import] Couldn't rename ${path}:`, error),
	);
}

async function importSetting<K extends SettingKey>(
	key: K,
	read: () => Promise<SettingValue<K> | null>,
) {
	if (await readStoredSetting(db, key)) return;
	const value = await read();
	if (!value) return;
	await writeSetting(db, key, value);
	console.log(`[import] setting "${key}"`);
}

async function importPersonality() {
	const [persona, chatRules, lore, notes] = await Promise.all(
		["persona.md", "chat-rules.md", "lore.md", "issues.txt"].map((file) =>
			readOptional(join(CONFIG, file)),
		),
	);
	if (!persona && !chatRules && !lore && !notes) return null;
	return {
		persona: persona,
		chatRules: chatRules,
		lore: lore,
		notes: notes,
	};
}

async function importExamples() {
	if ((await loadExamples(db)).length > 0) return;
	const [liked, disliked, tags] = await Promise.all([
		readOptional(join(CONFIG, "examples.txt")).then(lines),
		readOptional(join(CONFIG, "disliked.txt")).then(lines),
		readJson(join(CONFIG, "taste/example-tags.json"), tagsSchema),
	]);
	const added =
		(await addExamples(db, liked, true, tags ?? {})) +
		(await addExamples(db, disliked, false));
	if (added) console.log(`[import] ${added} examples`);
}

async function importDataFile<T>(
	file: string,
	schema: z.ZodType<T>,
	save: (value: T) => Promise<unknown>,
) {
	const path = join(DATA, file);
	const value = await readJson(path, schema);
	if (!value) return;
	await save(value);
	await markImported(path);
}

export async function importFiles() {
	await importSetting("taste", () =>
		readJson(join(CONFIG, "taste/taste.json"), tasteSchema),
	);
	await importSetting("personality", importPersonality);
	await importSetting("youtube-cookies", async () => {
		const text = await readOptional(COOKIES);
		return text ? { text } : null;
	});
	await importExamples();

	await importDataFile("dials.json", dialOverridesSchema, async (value) => {
		if (!(await readStoredSetting(db, "dial-overrides"))) {
			await writeSetting(db, "dial-overrides", value);
		}
	});
	await importDataFile("lore.json", loreSchema, async (lore) => {
		if (Object.keys(await loadLore(db)).length === 0) {
			await changeLore(db, Object.entries(lore));
		}
	});
	await importDataFile("profiles.json", profilesSchema, async (profiles) => {
		if (Object.keys(await loadProfiles(db)).length === 0) {
			await saveProfiles(db, profiles);
		}
	});
}
