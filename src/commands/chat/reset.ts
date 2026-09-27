import { CHAT_RESET_MARKER } from "#/constants";
import type { Command } from "#/types";

export const reset: Command = {
	name: "reset",
	description: "Make the AI forget the chat history in this channel",
	slashOnly: true,
	async run(ctx) {
		await ctx.reply(CHAT_RESET_MARKER);
	},
};
