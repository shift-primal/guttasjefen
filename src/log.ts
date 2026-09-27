import type { TextBasedChannel } from "discord.js";

export function elapsed(start: number) {
	return `${((performance.now() - start) / 1000).toFixed(1)}s`;
}

export function channelName(channel: TextBasedChannel | null) {
	return channel && "name" in channel ? `#${channel.name}` : "unknown channel";
}

export function preview(text: string, max = 120) {
	const flat = text.replaceAll("\n", " ").trim();
	return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
