import { commands } from "#/commands";
import { CMD_PREFIX } from "#/constants";
import { formatArgument } from "#/format";
import type { Command } from "#/types";

export const help: Command = {
	name: "help",
	aliases: ["h", "?"],
	description: "Show help and list available commands",
	async run(ctx) {
		const lines = commands.map((cmd) => {
			const arg = cmd.argument ? ` \`${formatArgument(cmd.argument)}\`` : "";
			const aliases = cmd.aliases?.length
				? ` (${cmd.aliases.map((alias) => `${CMD_PREFIX}${alias}`).join(", ")})`
				: "";

			return `**${CMD_PREFIX}${cmd.name}**${arg}${aliases}\n-# ${cmd.description}`;
		});

		lines.push("\nEvery command also works as a slash command, e.g. `/play`.");

		await ctx.reply(lines.join("\n \n"));
	},
};
