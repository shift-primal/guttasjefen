import { requireQueue } from "#/commands/guards";
import { skipCurrent } from "#/commands/playback";
import { formatNowPlaying, formatTrack } from "#/format";
import type { Command } from "#/types";

export const skip: Command = {
	name: "skip",
	aliases: ["n", "next"],
	description: "Skip the current track",
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		const skipped = queue.currentTrack;

		const [next] = queue.tracks.toArray();

		skipCurrent(queue);

		await ctx.reply(
			[
				`⏭️ **Skipped:** ${formatTrack(skipped)}`,
				next ? formatNowPlaying(next) : "The queue is now empty.",
			].join("\n"),
		);
	},
};
