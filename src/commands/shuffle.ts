import { requireQueue } from "#/commands/queue-guard";
import type { Command } from "#/types";

export const shuffle: Command = {
	name: "shuffle",
	description: "Shuffle the queue",
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		if (queue.tracks.size < 2) {
			await ctx.reply("Not enough tracks in the queue to shuffle.", {
				ephemeral: true,
			});
			return;
		}

		queue.tracks.shuffle();
		await ctx.reply(`Shuffled ${queue.tracks.size} tracks.`);
	},
};
