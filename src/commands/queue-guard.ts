import { type GuildQueue, useQueue } from "discord-player";
import type { CommandContext } from "#/types";

export async function requireQueue(
	ctx: CommandContext,
	{ sameChannel = true } = {},
): Promise<GuildQueue | null> {
	const queue = useQueue(ctx.guild);

	if (!queue?.currentTrack) {
		await ctx.reply("Nothing is playing right now.", { ephemeral: true });
		return null;
	}

	if (sameChannel && ctx.member.voice.channelId !== queue.channel?.id) {
		await ctx.reply("You need to be in my voice channel to do that!", {
			ephemeral: true,
		});
		return null;
	}

	return queue;
}
