import { commands } from "#/commands";
import type { Command } from "#/types";

export const help: Command = {
	name: "help",
	aliases: ["h", "?"],
	description: "Show help and list available commands",
	async run(ctx) {
		// Plain markdown wraps to any screen width, unlike a fixed-width table.
		const lines = commands.map((cmd) => {
			const arg = cmd.argument
				? ` \`${cmd.argument.required ? `<${cmd.argument.name}>` : `[${cmd.argument.name}]`}\``
				: "";
			const aliases = cmd.aliases?.length
				? ` (${cmd.aliases.map((alias) => `-${alias}`).join(", ")})`
				: "";

			// "-#" is Discord's small grey subtext.
			return `**-${cmd.name}**${arg}${aliases}\n-# ${cmd.description}`;
		});

		lines.push("\nEvery command also works as a slash command, e.g. `/play`.");

		await ctx.reply(lines.join("\n \n"));
	},
};
