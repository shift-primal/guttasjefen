import { findTrack } from "#/commands/find-track";
import { refuse, requireQueue } from "#/commands/guards";
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

		const upcoming = queue.tracks.toArray();
		if (upcoming.length === 0) {
			return refuse(ctx, "There is nothing queued to remove.");
		}

		const target = findTrack(upcoming, ctx.args);
		if (!target) {
			return refuse(
				ctx,
				`No track in the queue matches "${ctx.args}". Use its number from the queue command, or part of its title.`,
			);
		}

		queue.removeTrack(target);

		const position = upcoming.indexOf(target) + 1;
		await ctx.reply(`🗑️ **Removed #${position}:** ${formatTrack(target)}`);
	},
};
