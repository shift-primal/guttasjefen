import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import { ping } from "#/commands/ping";
import { play } from "#/commands/play";
import type { Command, CommandContext } from "#/types";

export const commands: Command[] = [ping, play];

// Lookup by name and alias, for `-` commands.
const byName = new Map<string, Command>(
	commands.flatMap((c) => [c.name, ...(c.aliases ?? [])].map((n) => [n, c])),
);

export function findCommand(name: string): Command | undefined {
	return byName.get(name.toLowerCase());
}

/** Slash command definition derived from a Command. */
export function toSlashJSON(command: Command) {
	const builder = new SlashCommandBuilder()
		.setName(command.name)
		.setDescription(command.description)
		.setContexts(InteractionContextType.Guild);

	const arg = command.argument;
	if (arg) {
		builder.addStringOption((option) =>
			option
				.setName(arg.name)
				.setDescription(arg.description)
				.setRequired(arg.required ?? false),
		);
	}
	return builder.toJSON();
}

export async function runCommand(command: Command, ctx: CommandContext) {
	try {
		await command.run(ctx);
	} catch (error) {
		console.error(error);
		await ctx.reply("Something went wrong.", { ephemeral: true });
	}
}
