import { refuse, requireQueue } from "#/commands/guards";
import type { Command } from "#/types";

export const shuffle: Command = {
	name: "shuffle",
	aliases: ["shuff"],
	description: "Shuffle the queue",
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		if (queue.tracks.size < 2) {
			return refuse(ctx, "Not enough tracks in the queue to shuffle.");
		}

		queue.tracks.shuffle();
		await ctx.reply(`Shuffled ${queue.tracks.size} tracks.`);
	},
};
