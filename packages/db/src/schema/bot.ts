import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import type { BotJobKind, GuildChannel, GuildRole } from "../settings";

export const botJob = pgTable("bot_job", {
	id: serial("id").primaryKey(),
	kind: text("kind").$type<BotJobKind>().notNull(),
	status: text("status")
		.$type<"pending" | "running" | "done" | "failed">()
		.default("pending")
		.notNull(),
	error: text("error"),
	requestedBy: text("requested_by"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	startedAt: timestamp("started_at"),
	finishedAt: timestamp("finished_at"),
});

export const discordGuild = pgTable("discord_guild", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	channels: jsonb("channels").$type<GuildChannel[]>().notNull(),
	roles: jsonb("roles").$type<GuildRole[]>().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
