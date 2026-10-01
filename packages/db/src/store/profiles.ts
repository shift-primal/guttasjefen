import { eq } from "drizzle-orm";
import type { Db } from "../index";
import { profile } from "../schema";

export type Profile = { name: string; notes: string };
export type Profiles = Record<string, Profile>;

export async function loadProfiles(db: Db): Promise<Profiles> {
	const rows = await db.select().from(profile);
	return Object.fromEntries(
		rows.map(({ userId, name, notes }) => [userId, { name, notes }]),
	);
}

export async function saveProfiles(db: Db, profiles: Profiles) {
	const entries = Object.entries(profiles);
	if (entries.length === 0) return;
	await db.transaction(async (tx) => {
		for (const [userId, { name, notes }] of entries) {
			await tx
				.insert(profile)
				.values({ userId, name, notes })
				.onConflictDoUpdate({
					target: profile.userId,
					set: { name, notes, updatedAt: new Date() },
				});
		}
	});
}

export async function clearProfile(db: Db, userId: string) {
	const removed = await db
		.delete(profile)
		.where(eq(profile.userId, userId))
		.returning({ userId: profile.userId });
	return removed.length > 0;
}
