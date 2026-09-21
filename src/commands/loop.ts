import { refuse, requireQueue } from "#/commands/guards";
import { MODES, nextRepeatMode } from "#/player/repeat-mode";
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

		const requested = ctx.args.toLowerCase();
		const next = nextRepeatMode(queue.repeatMode);
		const chosen = requested
			? MODES.find((m) => m.names.includes(requested))
			: MODES.find((m) => m.mode === next);
		if (!chosen) {
			return refuse(ctx, "Mode must be one of: off, track, queue, autoplay.");
		}

		queue.setRepeatMode(chosen.mode);
		await ctx.reply(`Loop: ${chosen.label}.`);
	},
};
