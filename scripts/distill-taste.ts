import { join } from "node:path";
import { parseArgs } from "node:util";
import { generateText } from "ai";
import { z } from "zod";
import { CONFIG_DIR } from "#/config/bot";
import { mapLimit } from "#/helpers/async";
import { readOptional } from "#/helpers/fs";
import { parseJsonObject } from "#/helpers/text";
import { DISTILL_MAX_TOKENS, model } from "#/personality/config";
import { poolEntries } from "#/personality/prompt";
import {
	DISTILL_DIALS_SYSTEM,
	TAG_EXAMPLES_SYSTEM,
} from "#/personality/prompts";
import {
	clampDial,
	loadTags,
	loadTaste,
	saveJson,
	type Tags,
	type Taste,
	tagsPath,
	tastePath,
} from "#/personality/taste";

const TAG_BATCH = 30;
const CONCURRENCY = 4;

const { values } = parseArgs({
	options: {
		config: { type: "string", short: "c", default: CONFIG_DIR },
		fresh: { type: "boolean", default: false },
	},
});
const configDir = values.config;

const dialsSchema = z.object({
	notes: z.string(),
	dials: z.record(z.string(), z.object({ low: z.string(), high: z.string() })),
});
const batchTagsSchema = z.record(z.string(), z.array(z.coerce.number()));

const [examples, disliked] = await Promise.all([
	readOptional(join(configDir, "examples.txt")).then(poolEntries),
	readOptional(join(configDir, "disliked.txt")).then(poolEntries),
]);
if (examples.length === 0) {
	console.error(`No examples in ${configDir}/examples.txt`);
	process.exit(1);
}

async function distillDials(): Promise<Taste> {
	console.log(
		`Distilling dials from ${examples.length} liked and ${disliked.length} disliked replies...`,
	);
	const prompt = [
		`Liked:\n${examples.map((e) => `- ${e}`).join("\n")}`,
		disliked.length
			? `Disliked:\n${disliked.map((e) => `- ${e}`).join("\n")}`
			: "",
	]
		.filter(Boolean)
		.join("\n\n");
	const { text } = await generateText({
		model,
		temperature: 0.3,
		maxOutputTokens: DISTILL_MAX_TOKENS,
		system: DISTILL_DIALS_SYSTEM,
		prompt,
	});
	const { notes, dials } = dialsSchema.parse(parseJsonObject(text));
	return {
		// A fresh distill keeps the on/off switch as it was
		enabled: (await loadTaste(configDir))?.enabled ?? true,
		notes,
		dials: Object.fromEntries(
			Object.entries(dials).map(([name, d]) => [name, { value: 0, ...d }]),
		),
	};
}

async function tagBatch(taste: Taste, batch: string[]): Promise<Tags> {
	const names = Object.keys(taste.dials);
	const dials = Object.entries(taste.dials)
		.map(([name, { low, high }]) => `- ${name}: -2 = ${low}, 2 = ${high}`)
		.join("\n");
	const numbered = batch.map((e, i) => `${i + 1}. ${e}`).join("\n");
	const { text } = await generateText({
		model,
		temperature: 0,
		maxOutputTokens: DISTILL_MAX_TOKENS,
		system: TAG_EXAMPLES_SYSTEM,
		prompt: `Dials:\n${dials}\n\nReplies:\n${numbered}`,
	});
	const rated = batchTagsSchema.parse(parseJsonObject(text));
	const tags: Tags = {};
	for (const [i, entry] of batch.entries()) {
		const rating = rated[String(i + 1)];
		if (!rating || rating.length !== names.length) continue;
		tags[entry] = Object.fromEntries(
			names.map((name, j) => [name, clampDial(Math.round(rating[j] ?? 0))]),
		);
	}
	return tags;
}

const existing = values.fresh ? null : await loadTaste(configDir);
const taste = existing ?? (await distillDials());
const dialNames = Object.keys(taste.dials);

const oldTags = existing ? await loadTags(configDir) : {};
const tags: Tags = {};
for (const entry of examples) {
	const t = oldTags[entry];
	if (t && dialNames.every((name) => name in t)) tags[entry] = t;
}
const untagged = examples.filter((e) => !(e in tags));

if (untagged.length) {
	console.log(`Tagging ${untagged.length} examples...`);
	const batches = Array.from(
		{ length: Math.ceil(untagged.length / TAG_BATCH) },
		(_, i) => untagged.slice(i * TAG_BATCH, (i + 1) * TAG_BATCH),
	);
	const results = await mapLimit(batches, CONCURRENCY, (batch) =>
		tagBatch(taste, batch).catch((error) => {
			console.error("Tagging a batch failed:", error);
			return {};
		}),
	);
	for (const result of results) Object.assign(tags, result);
}

if (!existing) {
	for (const name of dialNames) {
		const tagged = Object.values(tags).flatMap((t) =>
			t[name] === undefined ? [] : [t[name]],
		);
		const dial = taste.dials[name];
		if (dial && tagged.length) {
			const mean = tagged.reduce((sum, v) => sum + v, 0) / tagged.length;
			dial.value = Math.round(mean * 2) / 2;
		}
	}
	await saveJson(tastePath(configDir), taste);
}
await saveJson(tagsPath(configDir), tags);

console.log(`\n${taste.notes}\n`);
for (const [name, { value, low, high }] of Object.entries(taste.dials)) {
	console.log(
		`${name.padEnd(20)} ${String(value).padStart(4)}   ${low} ↔ ${high}`,
	);
}
const missing = examples.length - Object.keys(tags).length;
console.log(
	`\n${existing ? "Kept" : "Wrote"} ${tastePath(configDir)}, tagged ${Object.keys(tags).length}/${examples.length} examples${missing ? ` (${missing} failed, rerun to retry)` : ""}`,
);
