import type { GuildMember, TextBasedChannel } from "discord.js";

export function channelName(channel: TextBasedChannel | null): string {
	return channel && "name" in channel ? `#${channel.name}` : "unknown channel";
}

export function preview(text: string, max = 120): string {
	const flat = text.replaceAll("\n", " ").trim();
	return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

export function hasRole(member: GuildMember, name: string): boolean {
	const wanted = name.toLowerCase();
	return member.roles.cache.some((role) => role.name.toLowerCase() === wanted);
}
