import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { CONFIG_DIR } from "#/config/bot";
import { readOptional } from "#/helpers/fs";
import {
	DIAL_JITTER,
	DIAL_LIMIT,
	DIAL_OVERRIDES_PATH,
} from "#/personality/config";

const dialSchema = z.object({
	value: z.number(),
	low: z.string(),
	high: z.string(),
});
const tasteSchema = z.object({
	// false switches the whole dial system off without deleting anything
	enabled: z.boolean().default(true),
	notes: z.string().default(""),
	dials: z.record(z.string(), dialSchema),
});
const tagsSchema = z.record(z.string(), z.record(z.string(), z.number()));
// Changes made from Discord, kept apart from taste.json since config/ is read-only in Docker
const overridesSchema = z.object({
	enabled: z.boolean().optional(),
	dials: z.record(z.string(), z.number()).default({}),
});

export type Dial = z.infer<typeof dialSchema>;
export type Taste = z.infer<typeof tasteSchema>;
export type Tags = z.infer<typeof tagsSchema>;
export type DialOverrides = z.infer<typeof overridesSchema>;

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

export async function loadDialOverrides(): Promise<DialOverrides> {
	return (
		(await readJson(DIAL_OVERRIDES_PATH, overridesSchema)) ?? { dials: {} }
	);
}

export async function saveDialOverrides(overrides: DialOverrides) {
	await mkdir(dirname(DIAL_OVERRIDES_PATH), { recursive: true });
	await saveJson(DIAL_OVERRIDES_PATH, overrides);
}

// Changes the saved overrides, dropping any that just repeat taste.json
export async function updateDialOverrides(
	taste: Taste,
	change: (overrides: DialOverrides) => DialOverrides,
) {
	const { enabled, dials } = change(await loadDialOverrides());
	await saveDialOverrides({
		...(enabled !== undefined && enabled !== taste.enabled ? { enabled } : {}),
		dials: Object.fromEntries(
			Object.entries(dials).filter(
				([name, value]) =>
					taste.dials[name] && taste.dials[name].value !== value,
			),
		),
	});
}

// taste.json with the Discord overrides on top. Overrides for dials that no
// longer exist (after a fresh distill) are ignored
export async function loadTunedTaste(configDir = CONFIG_DIR) {
	const taste = await loadTaste(configDir);
	if (!taste) return null;
	const { enabled, dials } = await loadDialOverrides();
	const known = Object.entries(dials).filter(([name]) => name in taste.dials);
	return {
		...withOverrides(taste, Object.fromEntries(known)),
		enabled: enabled ?? taste.enabled,
	};
}

// The taste the bot should use right now, or null when it's switched off
export async function loadActiveTaste(configDir = CONFIG_DIR) {
	const taste = await loadTunedTaste(configDir);
	return taste?.enabled ? taste : null;
}

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
