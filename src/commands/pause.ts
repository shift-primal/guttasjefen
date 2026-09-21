import { requireQueue } from "#/commands/queue-guard";
import type { Command } from "#/types";

export const pause: Command = {
	name: "pause",
	aliases: ["resume"],
	description: "Pause or resume the current track",
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		const paused = !queue.node.isPaused();
		queue.node.setPaused(paused);
		await ctx.reply(paused ? "Paused." : "Resumed.");
	},
};
