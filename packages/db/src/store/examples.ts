import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../index";
import { example } from "../schema";

export type Example = typeof example.$inferSelect;

export const loadExamples = (db: Db, liked?: boolean) =>
	db
		.select()
		.from(example)
		.where(liked === undefined ? undefined : eq(example.liked, liked))
		.orderBy(asc(example.id));

export async function addExamples(
	db: Db,
	texts: string[],
	liked: boolean,
	tags: Record<string, Record<string, number>> = {},
) {
	if (texts.length === 0) return 0;
	const added = await db
		.insert(example)
		.values(texts.map((text) => ({ text, liked, tags: tags[text] ?? null })))
		.onConflictDoNothing()
		.returning({ id: example.id });
	return added.length;
}

export async function updateExample(
	db: Db,
	id: number,
	change: { text?: string; liked?: boolean },
) {
	await db.update(example).set(change).where(eq(example.id, id));
}

export async function deleteExample(db: Db, id: number) {
	await db.delete(example).where(eq(example.id, id));
}

export async function saveExampleTags(
	db: Db,
	tags: { id: number; text: string; tags: Record<string, number> }[],
) {
	await db.transaction(async (tx) => {
		for (const row of tags) {
			await tx
				.update(example)
				.set({ tags: row.tags })
				.where(and(eq(example.id, row.id), eq(example.text, row.text)));
		}
	});
}
