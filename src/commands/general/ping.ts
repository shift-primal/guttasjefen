import type { Command } from "#/types";

export const ping: Command = {
	name: "ping",
	description: "Pong!",
	async run(ctx) {
		await ctx.reply("Pong!");
	},
};
