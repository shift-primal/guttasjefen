import { clearProfile } from "#/ai/profiles";
import { CHAT_RESET_MARKER } from "#/constants";
import type { Command } from "#/types";

export const reset: Command = {
	name: "reset",
	description:
		"Make the AI forget this channel's chat history and its notes on you",
	slashOnly: true,
	async run(ctx) {
		const cleared = await clearProfile(ctx.member.id);
		await ctx.reply(
			cleared
				? `${CHAT_RESET_MARKER} Notes on ${ctx.member.displayName} wiped too.`
				: CHAT_RESET_MARKER,
		);
	},
};
