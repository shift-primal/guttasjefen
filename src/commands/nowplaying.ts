import { requireQueue } from "#/commands/queue-guard";
import type { Command } from "#/types";

export const nowplaying: Command = {
	name: "nowplaying",
	aliases: ["np"],
	description: "Show the track that is playing right now",
	async run(ctx) {
		const queue = await requireQueue(ctx, { sameChannel: false });
		if (!queue?.currentTrack) return;

		const track = queue.currentTrack;
		const bar = queue.node.createProgressBar();
		await ctx.reply(
			[`Now playing: **${track.title}** by ${track.author}`, bar, track.url]
				.filter(Boolean)
				.join("\n"),
		);
	},
};
