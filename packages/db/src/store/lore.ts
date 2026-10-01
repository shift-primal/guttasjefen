import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "../index";
import { loreEntry } from "../schema";

// "Nils" → "kompis fra bærum, flytta til oslo", plus "meg" for facts about itself
export type Lore = Record<string, string>;

export async function loadLore(db: Db): Promise<Lore> {
	const rows = await db
		.select({ key: loreEntry.key, notes: loreEntry.notes })
		.from(loreEntry)
		.orderBy(asc(loreEntry.createdAt));
	return Object.fromEntries(rows.map(({ key, notes }) => [key, notes]));
}

// A string adds or updates an entry, null removes it
export async function changeLore(
	db: Db,
	changes: [key: string, notes: string | null][],
) {
	await db.transaction(async (tx) => {
		for (const [key, notes] of changes) {
			if (notes === null) {
				await tx.delete(loreEntry).where(eq(loreEntry.key, key));
			} else {
				await tx
					.insert(loreEntry)
					.values({ key, notes })
					.onConflictDoUpdate({
						target: loreEntry.key,
						set: { notes, updatedAt: new Date() },
					});
			}
		}
	});
}

export async function forgetLore(db: Db, key: string) {
	const [found] = await db
		.select({ key: loreEntry.key })
		.from(loreEntry)
		.where(sql`lower(${loreEntry.key}) = lower(${key})`)
		.limit(1);
	if (!found) return null;
	await db.delete(loreEntry).where(eq(loreEntry.key, found.key));
	return found.key;
}
