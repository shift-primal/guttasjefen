import { deleteGuild, loadGuilds, saveGuild } from "@guttasjefen/db";
import { type Client, Events, type Guild } from "discord.js";
import { db } from "#/db";

const PUBLISH_DELAY_MS = 2000;
const pending = new Map<string, NodeJS.Timeout>();

async function publish(guild: Guild) {
	await saveGuild(db, {
		id: guild.id,
		name: guild.name,
		channels: guild.channels.cache
			.filter((channel) => !channel.isThread())
			.map(({ id, name, type }) => ({ id, name, type })),
		roles: guild.roles.cache
			.filter((role) => role.id !== guild.id)
			.map(({ id, name }) => ({ id, name })),
	});
}

function schedule(guild: Guild) {
	clearTimeout(pending.get(guild.id));
	pending.set(
		guild.id,
		setTimeout(() => {
			pending.delete(guild.id);
			publish(guild).catch((error) =>
				console.error(`[guilds] Publishing ${guild.name} failed:`, error),
			);
		}, PUBLISH_DELAY_MS),
	);
}

async function publishAll(client: Client<true>) {
	const known = await loadGuilds(db);
	for (const { id } of known) {
		if (!client.guilds.cache.has(id)) await deleteGuild(db, id);
	}
	await Promise.all(client.guilds.cache.map(publish));
}

export function registerGuildSync(client: Client) {
	client.once(Events.ClientReady, (c) => {
		publishAll(c).catch((error) =>
			console.error("[guilds] Publishing failed:", error),
		);
	});
	client.on(Events.GuildCreate, schedule);
	client.on(Events.GuildUpdate, (_old, guild) => schedule(guild));
	client.on(Events.GuildDelete, (guild) => {
		deleteGuild(db, guild.id).catch(console.error);
	});
	for (const event of [Events.ChannelCreate, Events.ChannelDelete] as const) {
		client.on(event, (channel) => {
			if ("guild" in channel && channel.guild) schedule(channel.guild);
		});
	}
	client.on(Events.ChannelUpdate, (_old, channel) => {
		if ("guild" in channel && channel.guild) schedule(channel.guild);
	});
	client.on(Events.GuildRoleCreate, (role) => schedule(role.guild));
	client.on(Events.GuildRoleDelete, (role) => schedule(role.guild));
	client.on(Events.GuildRoleUpdate, (_old, role) => schedule(role.guild));
}
