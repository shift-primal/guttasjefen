import { enqueue } from "#/commands/playback";
import type { Command } from "#/types";

export const playNow: Command = {
	name: "playnow",
	aliases: ["pnow"],
	description: "Skip the current song and play this one now, keeping the queue",
	argument: {
		name: "song",
		description: "The song to play right now",
		required: true,
	},
	run: (ctx) => enqueue(ctx, "now"),
};
