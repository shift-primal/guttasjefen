import { QueueRepeatMode } from "discord-player";
import { requireQueue } from "#/commands/queue-guard";
import type { Command } from "#/types";

const MODES: Record<string, QueueRepeatMode> = {
	off: QueueRepeatMode.OFF,
	track: QueueRepeatMode.TRACK,
	song: QueueRepeatMode.TRACK,
	queue: QueueRepeatMode.QUEUE,
	autoplay: QueueRepeatMode.AUTOPLAY,
};

const LABELS: Record<QueueRepeatMode, string> = {
	[QueueRepeatMode.OFF]: "off",
	[QueueRepeatMode.TRACK]: "repeating the current track",
	[QueueRepeatMode.QUEUE]: "repeating the queue",
	[QueueRepeatMode.AUTOPLAY]: "autoplay",
};

const NEXT: Partial<Record<QueueRepeatMode, QueueRepeatMode>> = {
	[QueueRepeatMode.OFF]: QueueRepeatMode.TRACK,
	[QueueRepeatMode.TRACK]: QueueRepeatMode.QUEUE,
};

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

		let mode: QueueRepeatMode;
		if (ctx.args) {
			const parsed = MODES[ctx.args.toLowerCase()];
			if (parsed === undefined) {
				await ctx.reply("Mode must be one of: off, track, queue, autoplay.", {
					ephemeral: true,
				});
				return;
			}
			mode = parsed;
		} else {
			mode = NEXT[queue.repeatMode] ?? QueueRepeatMode.OFF;
		}

		queue.setRepeatMode(mode);
		await ctx.reply(`Loop: ${LABELS[mode]}.`);
	},
};
