import { eq, sql } from "drizzle-orm";
import type { Db } from "../index";
import { botJob } from "../schema";
import type { BotJobKind } from "../settings";

export type BotJob = typeof botJob.$inferSelect;

export async function requestJob(
	db: Db,
	kind: BotJobKind,
	requestedBy: string | null = null,
) {
	const [job] = await db
		.insert(botJob)
		.values({ kind, requestedBy })
		.returning();
	return job as BotJob;
}

export async function claimJob(db: Db): Promise<BotJob | null> {
	const result = await db.execute<BotJob>(sql`
		update ${botJob} set status = 'running', started_at = now()
		where id = (
			select id from ${botJob} where status = 'pending'
			order by id for update skip locked limit 1
		)
		returning id, kind, status, error, requested_by as "requestedBy",
			created_at as "createdAt", started_at as "startedAt", finished_at as "finishedAt"`);
	return result.rows[0] ?? null;
}

export async function finishJob(db: Db, id: number, error?: unknown) {
	await db
		.update(botJob)
		.set({
			status: error === undefined ? "done" : "failed",
			error: error === undefined ? null : String(error),
			finishedAt: new Date(),
		})
		.where(eq(botJob.id, id));
}

export async function failInterruptedJobs(db: Db) {
	await db
		.update(botJob)
		.set({
			status: "failed",
			error: "The bot restarted while this was running",
			finishedAt: new Date(),
		})
		.where(eq(botJob.status, "running"));
}

export const loadJobs = (db: Db, limit = 20) =>
	db.select().from(botJob).orderBy(sql`${botJob.id} desc`).limit(limit);
