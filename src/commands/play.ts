import { enqueue } from "#/commands/playback";
import type { Command } from "#/types";

export const play: Command = {
	name: "play",
	aliases: ["p"],
	description: "Play a song in a voice channel",
	argument: { name: "song", description: "The song to play", required: true },
	run: (ctx) => enqueue(ctx, "end"),
};
