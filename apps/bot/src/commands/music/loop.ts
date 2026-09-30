import { refuse, requireQueue } from "#/commands/guards";
import {
	findRepeatMode,
	nextRepeatMode,
	repeatModeInfo,
} from "#/music/repeat-mode";
import type { Command } from "#/types";

export const loop: Command = {
	name: "loop",
	aliases: ["repeat"],
	description: "Set the loop mode (off, track, queue, autoplay)",
	argument: {
		name: "mode",
		description: "off, track, queue or autoplay (leave empty to cycle)",
	},
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		const chosen = ctx.args
			? findRepeatMode(ctx.args)
			: repeatModeInfo(nextRepeatMode(queue.repeatMode));
		if (!chosen) {
			return refuse(ctx, "Mode must be one of: off, track, queue, autoplay.");
		}

		queue.setRepeatMode(chosen.mode);
		await ctx.reply(`Loop: ${chosen.label}.`);
	},
};
