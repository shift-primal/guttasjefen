import { eq } from "drizzle-orm";
import type { Db } from "../index";
import { discordGuild } from "../schema";

export type DiscordGuild = typeof discordGuild.$inferInsert;

export async function saveGuild(db: Db, guild: DiscordGuild) {
	const updatedAt = new Date();
	await db
		.insert(discordGuild)
		.values({ ...guild, updatedAt })
		.onConflictDoUpdate({
			target: discordGuild.id,
			set: {
				name: guild.name,
				channels: guild.channels,
				roles: guild.roles,
				updatedAt,
			},
		});
}

export async function deleteGuild(db: Db, id: string) {
	await db.delete(discordGuild).where(eq(discordGuild.id, id));
}

export const loadGuilds = (db: Db) => db.select().from(discordGuild);
