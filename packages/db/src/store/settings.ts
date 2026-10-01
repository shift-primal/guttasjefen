import { eq } from "drizzle-orm";
import type { Db } from "../index";
import { setting } from "../schema";
import {
	type DialOverrides,
	pruneOverrides,
	type SettingKey,
	type SettingValue,
	settingSchemas,
	type Taste,
	tuneTaste,
} from "../settings";

function parseSetting<K extends SettingKey>(key: K, value: unknown) {
	const parsed = settingSchemas[key].safeParse(value);
	if (parsed.success) return parsed.data as SettingValue<K>;
	console.error(`Ignoring invalid "${key}" setting:`, parsed.error);
	return null;
}

export async function readStoredSetting<K extends SettingKey>(db: Db, key: K) {
	const [row] = await db
		.select({ value: setting.value })
		.from(setting)
		.where(eq(setting.key, key));
	return row ? parseSetting(key, row.value) : null;
}

export async function readSetting<K extends SettingKey>(
	db: Db,
	key: K,
): Promise<SettingValue<K>> {
	return (
		(await readStoredSetting(db, key)) ??
		(settingSchemas[key].parse({}) as SettingValue<K>)
	);
}

export async function writeSetting<K extends SettingKey>(
	db: Db,
	key: K,
	value: SettingValue<K>,
	updatedBy: string | null = null,
) {
	const checked = settingSchemas[key].parse(value);
	const updatedAt = new Date();
	await db
		.insert(setting)
		.values({ key, value: checked, updatedAt, updatedBy })
		.onConflictDoUpdate({
			target: setting.key,
			set: { value: checked, updatedAt, updatedBy },
		});
}

export function changeSetting<K extends SettingKey>(
	db: Db,
	key: K,
	change: (current: SettingValue<K>) => SettingValue<K>,
	updatedBy: string | null = null,
) {
	const fallback = settingSchemas[key].parse({}) as SettingValue<K>;
	return db.transaction(async (tx) => {
		await tx
			.insert(setting)
			.values({ key, value: fallback, updatedBy })
			.onConflictDoNothing();
		const [row] = await tx
			.select({ value: setting.value })
			.from(setting)
			.where(eq(setting.key, key))
			.for("update");
		const current = parseSetting(key, row?.value) ?? fallback;
		const next = settingSchemas[key].parse(change(current)) as SettingValue<K>;
		await tx
			.update(setting)
			.set({ value: next, updatedAt: new Date(), updatedBy })
			.where(eq(setting.key, key));
		return next;
	});
}

export const loadTaste = (db: Db) => readStoredSetting(db, "taste");

export const saveTaste = (db: Db, taste: Taste) =>
	writeSetting(db, "taste", taste);

export const loadDialOverrides = (db: Db) => readSetting(db, "dial-overrides");

// Changes the saved overrides, dropping any that just repeat the taste
export function updateDialOverrides(
	db: Db,
	taste: Taste,
	change: (overrides: DialOverrides) => DialOverrides,
	updatedBy: string | null = null,
) {
	return changeSetting(
		db,
		"dial-overrides",
		(current) => pruneOverrides(taste, change(current)),
		updatedBy,
	);
}

export async function loadTunedTaste(db: Db) {
	const [taste, overrides] = await Promise.all([
		loadTaste(db),
		loadDialOverrides(db),
	]);
	return taste && tuneTaste(taste, overrides);
}

// The taste replies should use right now, or null when the dials are switched off
export async function loadActiveTaste(db: Db) {
	const taste = await loadTunedTaste(db);
	return taste?.enabled ? taste : null;
}
