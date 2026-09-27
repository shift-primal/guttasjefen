import type { Guild, GuildMember } from "discord.js";
import { type GuildQueue, type Track, useQueue } from "discord-player";

export type ActiveQueue = GuildQueue & { currentTrack: Track };

export function checkQueueAccess(
	guild: Guild,
	member: GuildMember,
	{ sameChannel = true } = {},
): ActiveQueue | string {
	const queue = useQueue(guild);

	if (!queue?.currentTrack) return "Nothing is playing right now.";

	if (sameChannel && member.voice.channelId !== queue.channel?.id) {
		return "You need to be in my voice channel to do that!";
	}

	return queue as ActiveQueue;
}
