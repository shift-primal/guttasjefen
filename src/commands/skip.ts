import { requireQueue } from "#/commands/queue-guard";
import { formatTrack } from "#/format";
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

		queue.node.skip();

		const lines = [
			`⏭️ **Skipped:** ${skipped ? formatTrack(skipped) : "nothing"}`,
		];
		lines.push(
			next
				? `▶️ **Now playing:** ${formatTrack(next)}`
				: "The queue is now empty.",
		);
		await ctx.reply(lines.join("\n"));
	},
};
