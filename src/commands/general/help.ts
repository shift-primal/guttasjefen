import { describeChannels } from "#/bot/channels";
import { commands } from "#/commands";
import { CMD_PREFIX, MUSIC_CHANNEL_KEYWORDS } from "#/config/bot";
import { CHAT_HELP } from "#/personality";
import type { Command } from "#/types";
import { formatArgument } from "#/ui/format";

export const help: Command = {
	name: "help",
	aliases: ["h", "?"],
	description: "Show help and list available commands",
	anyChannel: true,
	async run(ctx) {
		const lines = commands.map((cmd) => {
			if (cmd.slashOnly) return `**/${cmd.name}**\n-# ${cmd.description}`;

			const arg = cmd.argument ? ` \`${formatArgument(cmd.argument)}\`` : "";
			const aliases = cmd.aliases?.length
				? ` (${cmd.aliases.map((alias) => `${CMD_PREFIX}${alias}`).join(", ")})`
				: "";

			return `**${CMD_PREFIX}${cmd.name}**${arg}${aliases}\n-# ${cmd.description}`;
		});

		lines.push("\nEvery command also works as a slash command, e.g. `/play`.");

		lines.push(
			`Prefix commands only work in ${describeChannels(MUSIC_CHANNEL_KEYWORDS)}.`,
		);

		lines.push(CHAT_HELP);

		await ctx.reply(lines.join("\n \n"));
	},
};
