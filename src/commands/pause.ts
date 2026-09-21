import { requireQueue } from "#/commands/queue-guard";
import type { Command } from "#/types";

export const pause: Command = {
	name: "pause",
	description: "Pause the current track",
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		if (queue.node.isPaused()) {
			await ctx.reply("Already paused. Use resume to continue.", {
				ephemeral: true,
			});
			return;
		}

		queue.node.setPaused(true);
		await ctx.reply("⏸️ Paused.");
	},
};
