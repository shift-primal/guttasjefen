import { requireQueue, requireUpcomingTrack } from "#/commands/guards";
import type { Command } from "#/types";
import { formatTrack } from "#/ui/format";

export const remove: Command = {
	name: "remove",
	aliases: ["rm"],
	description: "Remove a track from the queue, by its number or name",
	argument: {
		name: "track",
		description: "Queue number or part of the title",
		required: true,
	},
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		const target = await requireUpcomingTrack(ctx, queue, "remove");
		if (!target) return;

		queue.removeTrack(target.track);
		await ctx.reply(
			`🗑️ **Removed #${target.position}:** ${formatTrack(target.track)}`,
		);
	},
};
