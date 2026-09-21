import { requireQueue } from "#/commands/queue-guard";
import { formatTrack } from "#/format";
import type { Command } from "#/types";

export const nowplaying: Command = {
	name: "nowplaying",
	aliases: ["playing", "np"],
	description: "Show the track that is playing right now",
	async run(ctx) {
		const queue = await requireQueue(ctx, { sameChannel: false });
		if (!queue?.currentTrack) return;

		const bar = queue.node.createProgressBar();
		await ctx.reply(
			[`▶️ **Now playing:** ${formatTrack(queue.currentTrack)}`, bar]
				.filter(Boolean)
				.join("\n"),
		);
	},
};
