import { enqueue } from "#/commands/playback";
import type { Command } from "#/types";

export const playNext: Command = {
	name: "playnext",
	aliases: ["pn"],
	description:
		"Put a song at the top of the queue, without skipping the current one",
	argument: {
		name: "song",
		description: "The song to play next",
		required: true,
	},
	run: (ctx) => enqueue(ctx, "next"),
};
