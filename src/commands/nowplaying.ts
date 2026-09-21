import { requireQueue } from "#/commands/guards";
import { formatNowPlaying } from "#/format";
import type { Command } from "#/types";

export const nowplaying: Command = {
	name: "nowplaying",
	aliases: ["playing", "np"],
	description: "Show the track that is playing right now",
	async run(ctx) {
		const queue = await requireQueue(ctx, { sameChannel: false });
		if (!queue) return;

		const bar = queue.node.createProgressBar();
		await ctx.reply(
			[formatNowPlaying(queue.currentTrack), bar].filter(Boolean).join("\n"),
		);
	},
};
