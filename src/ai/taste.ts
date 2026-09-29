import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { CONFIG_DIR, DIAL_JITTER, DIAL_LIMIT } from "#/config/ai";
import { readOptional } from "#/helpers/fs";

const dialSchema = z.object({
	value: z.number(),
	low: z.string(),
	high: z.string(),
});
const tasteSchema = z.object({
	notes: z.string().default(""),
	dials: z.record(z.string(), dialSchema),
});
const tagsSchema = z.record(z.string(), z.record(z.string(), z.number()));

export type Dial = z.infer<typeof dialSchema>;
export type Taste = z.infer<typeof tasteSchema>;
export type Tags = z.infer<typeof tagsSchema>;

export const tastePath = (configDir = CONFIG_DIR) =>
	join(configDir, "taste.json");
export const tagsPath = (configDir = CONFIG_DIR) =>
	join(configDir, "example-tags.json");

async function readJson<T>(path: string, schema: z.ZodType<T>) {
	const text = await readOptional(path);
	if (!text) return null;
	try {
		return schema.parse(JSON.parse(text));
	} catch (error) {
		console.error(`Ignoring invalid ${path}:`, error);
		return null;
	}
}

export const loadTaste = (configDir = CONFIG_DIR) =>
	readJson(tastePath(configDir), tasteSchema);

export async function loadTags(configDir = CONFIG_DIR): Promise<Tags> {
	return (await readJson(tagsPath(configDir), tagsSchema)) ?? {};
}

export async function saveJson(path: string, data: unknown) {
	await writeFile(path, `${JSON.stringify(data, null, "\t")}\n`);
}

export function clampDial(value: number) {
	return Math.max(-DIAL_LIMIT, Math.min(DIAL_LIMIT, value));
}

function gaussian() {
	return (
		Math.sqrt(-2 * Math.log(1 - Math.random())) *
		Math.cos(2 * Math.PI * Math.random())
	);
}

export function jitterTaste(
	taste: Taste | null,
	spread = DIAL_JITTER,
): Taste | null {
	if (!taste || spread <= 0) return taste;
	const dials = Object.fromEntries(
		Object.entries(taste.dials).map(([name, dial]) => [
			name,
			Math.abs(dial.value) >= DIAL_LIMIT
				? dial
				: { ...dial, value: clampDial(dial.value + gaussian() * spread) },
		]),
	);
	return { ...taste, dials };
}

export function withOverrides(
	taste: Taste,
	overrides: Record<string, number>,
): Taste {
	const dials = { ...taste.dials };
	for (const [name, value] of Object.entries(overrides)) {
		const dial = dials[name];
		if (!dial) {
			throw new Error(
				`Unknown dial "${name}". Dials: ${Object.keys(dials).join(", ")}`,
			);
		}
		dials[name] = { ...dial, value: clampDial(value) };
	}
	return { ...taste, dials };
}

export function hasStrongLengthDial(taste: Taste | null) {
	return Object.entries(taste?.dials ?? {}).some(
		([name, { value }]) =>
			/length/i.test(name) && Math.abs(value) >= DIAL_LIMIT,
	);
}

export function strongDials(taste: Taste | null) {
	return Object.values(taste?.dials ?? {}).flatMap(({ value, low, high }) => {
		if (Math.abs(value) < DIAL_LIMIT) return [];
		return [value < 0 ? low : high];
	});
}

function describeDial({ value, low, high }: Dial) {
	// Rounds away from zero both ways, so -0.5 and 0.5 both lean
	const clamped = clampDial(value);
	const step = Math.sign(clamped) * Math.round(Math.abs(clamped));
	if (step === 0) return `between "${low}" and "${high}"`;
	const side = step < 0 ? low : high;
	return `${Math.abs(step) === DIAL_LIMIT ? "strongly" : "leaning"} toward "${side}"`;
}

export function describeTaste(taste: Taste | null) {
	if (!taste) return "";
	const dials = Object.entries(taste.dials).map(
		([name, dial]) => `- ${name}: ${describeDial(dial)}`,
	);
	return [taste.notes.trim(), dials.join("\n")].filter(Boolean).join("\n\n");
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

export function pickExamples(
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
		const [chosen] = pool.splice(index, 1);
		if (chosen) picked.push(chosen.entry);
	}
	return picked;
}
