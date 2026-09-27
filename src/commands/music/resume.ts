import { refuse, requireQueue } from "#/commands/guards";
import type { Command } from "#/types";

export const resume: Command = {
	name: "resume",
	aliases: ["res"],
	description: "Resume the paused track",
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		if (!queue.node.isPaused()) return refuse(ctx, "Nothing is paused.");

		queue.node.setPaused(false);
		await ctx.reply("▶️ Resumed.");
	},
};
