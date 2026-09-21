import { requireQueue } from "#/commands/guards";
import { skipCurrent } from "#/player/skip";
import type { Command } from "#/types";
import { formatTrack } from "#/ui/format";

export const skip: Command = {
	name: "skip",
	aliases: ["n", "next"],
	description: "Skip the current track",
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		const skipped = queue.currentTrack;

		const hasNext = queue.tracks.size > 0;

		skipCurrent(queue);

		await ctx.reply(
			[
				`⏭️ **Skipped:** ${formatTrack(skipped)}`,
				hasNext ? "" : "The queue is now empty.",
			]
				.filter(Boolean)
				.join("\n"),
		);
	},
};
