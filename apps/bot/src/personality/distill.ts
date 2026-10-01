import {
	type Example,
	loadExamples,
	loadTaste,
	saveExampleTags,
	saveTaste,
} from "@guttasjefen/db";
import { clampDial, type Taste } from "@guttasjefen/db/settings";
import { generateText } from "ai";
import { z } from "zod";
import { prompts, tunables } from "#/config/settings";
import { db } from "#/db";
import { mapLimit } from "#/helpers/async";
import { parseJsonObject } from "#/helpers/text";
import { chatModel } from "#/personality/config";

const TAG_BATCH = 30;
const CONCURRENCY = 4;

const dialsSchema = z.object({
	notes: z.string(),
	dials: z.record(z.string(), z.object({ low: z.string(), high: z.string() })),
});
const batchTagsSchema = z.record(z.string(), z.array(z.coerce.number()));

type Tagged = { id: number; text: string; tags: Record<string, number> };

async function distillDials(
	liked: string[],
	disliked: string[],
	enabled: boolean,
): Promise<Taste> {
	console.log(
		`Distilling dials from ${liked.length} liked and ${disliked.length} disliked replies...`,
	);
	const prompt = [
		`Liked:\n${liked.map((e) => `- ${e}`).join("\n")}`,
		disliked.length
			? `Disliked:\n${disliked.map((e) => `- ${e}`).join("\n")}`
			: "",
	]
		.filter(Boolean)
		.join("\n\n");
	const { text } = await generateText({
		model: chatModel(),
		temperature: 0.3,
		maxOutputTokens: tunables().distill.maxTokens,
		system: prompts().distillDialsSystem,
		prompt,
	});
	const { notes, dials } = dialsSchema.parse(parseJsonObject(text));
	return {
		enabled,
		notes,
		dials: Object.fromEntries(
			Object.entries(dials).map(([name, d]) => [name, { value: 0, ...d }]),
		),
	};
}

async function tagBatch(taste: Taste, batch: Example[]): Promise<Tagged[]> {
	const names = Object.keys(taste.dials);
	const dials = Object.entries(taste.dials)
		.map(([name, { low, high }]) => `- ${name}: -2 = ${low}, 2 = ${high}`)
		.join("\n");
	const numbered = batch.map((e, i) => `${i + 1}. ${e.text}`).join("\n");
	const { text } = await generateText({
		model: chatModel(),
		temperature: 0,
		maxOutputTokens: tunables().distill.maxTokens,
		system: prompts().tagExamplesSystem,
		prompt: `Dials:\n${dials}\n\nReplies:\n${numbered}`,
	});
	const rated = batchTagsSchema.parse(parseJsonObject(text));
	return batch.flatMap(({ id, text }, i) => {
		const rating = rated[String(i + 1)];
		if (!rating || rating.length !== names.length) return [];
		const tags = Object.fromEntries(
			names.map((name, j) => [name, clampDial(Math.round(rating[j] ?? 0))]),
		);
		return [{ id, text, tags }];
	});
}

async function tagExamples(taste: Taste, examples: Example[]) {
	const batches = Array.from(
		{ length: Math.ceil(examples.length / TAG_BATCH) },
		(_, i) => examples.slice(i * TAG_BATCH, (i + 1) * TAG_BATCH),
	);
	const results = await mapLimit(batches, CONCURRENCY, (batch) =>
		tagBatch(taste, batch).catch((error) => {
			console.error("Tagging a batch failed:", error);
			return [];
		}),
	);
	const tagged = results.flat();
	await saveExampleTags(db, tagged);
	return tagged;
}

const needsTags = (taste: Taste, { tags }: Example) =>
	!tags || Object.keys(taste.dials).some((name) => !(name in tags));

export async function distill({ fresh = false } = {}) {
	const examples = await loadExamples(db);
	const liked = examples.filter((e) => e.liked);
	if (liked.length === 0) throw new Error("No liked examples to distill from");

	const existing = await loadTaste(db);
	const taste =
		existing && !fresh
			? existing
			: await distillDials(
					liked.map((e) => e.text),
					examples.filter((e) => !e.liked).map((e) => e.text),
					// A fresh distill keeps the on/off switch as it was
					existing?.enabled ?? true,
				);
	const distilled = taste !== existing;
	const todo = distilled ? liked : liked.filter((e) => needsTags(taste, e));
	const tagged = todo.length ? await tagExamples(taste, todo) : [];

	if (distilled) {
		for (const [name, dial] of Object.entries(taste.dials)) {
			const values = tagged.flatMap(({ tags }) =>
				tags[name] === undefined ? [] : [tags[name]],
			);
			if (values.length) {
				const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
				dial.value = Math.round(mean * 2) / 2;
			}
		}
		await saveTaste(db, taste);
	}

	return {
		taste,
		distilled,
		tagged: liked.length - todo.length + tagged.length,
		failed: todo.length - tagged.length,
		total: liked.length,
	};
}

// Only tags; new dials need a fresh distill
export async function tagUntagged() {
	const taste = await loadTaste(db);
	if (!taste || Object.keys(taste.dials).length === 0) return 0;
	const todo = (await loadExamples(db, true)).filter((e) =>
		needsTags(taste, e),
	);
	if (todo.length === 0) return 0;
	return (await tagExamples(taste, todo)).length;
}
