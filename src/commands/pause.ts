import { refuse, requireQueue } from "#/commands/guards";
import type { Command } from "#/types";

export const pause: Command = {
	name: "pause",
	description: "Pause the current track",
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		if (queue.node.isPaused()) {
			return refuse(ctx, "Already paused. Use resume to continue.");
		}

		queue.node.setPaused(true);
		await ctx.reply("⏸️ Paused.");
	},
};
