import { QueueRepeatMode } from "discord-player";
import { refuse, requireQueue } from "#/commands/guards";
import type { Command } from "#/types";

const MODES = [
	{ mode: QueueRepeatMode.OFF, names: ["off"], label: "off" },
	{
		mode: QueueRepeatMode.TRACK,
		names: ["track", "song"],
		label: "repeating the current track",
	},
	{
		mode: QueueRepeatMode.QUEUE,
		names: ["queue"],
		label: "repeating the queue",
	},
	{ mode: QueueRepeatMode.AUTOPLAY, names: ["autoplay"], label: "autoplay" },
];

const CYCLE: QueueRepeatMode[] = [
	QueueRepeatMode.OFF,
	QueueRepeatMode.TRACK,
	QueueRepeatMode.QUEUE,
];

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
		const next = CYCLE[(CYCLE.indexOf(queue.repeatMode) + 1) % CYCLE.length];
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
