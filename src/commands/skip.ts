import { requireQueue } from "#/commands/queue-guard";
import type { Command } from "#/types";

export const skip: Command = {
	name: "skip",
	aliases: ["s", "next"],
	description: "Skip the current track",
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		const skipped = queue.currentTrack;
		queue.node.skip();
		await ctx.reply(`Skipped **${skipped?.title}**.`);
	},
};
