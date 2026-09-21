import { requireQueue } from "#/commands/queue-guard";
import type { Command } from "#/types";

export const resume: Command = {
	name: "resume",
	aliases: ["res"],
	description: "Resume the paused track",
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		if (!queue.node.isPaused()) {
			await ctx.reply("Nothing is paused.", { ephemeral: true });
			return;
		}

		queue.node.setPaused(false);
		await ctx.reply("▶️ Resumed.");
	},
};
