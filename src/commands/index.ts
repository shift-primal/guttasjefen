import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import { help } from "#/commands/help";
import { loop } from "#/commands/loop";
import { nowplaying } from "#/commands/nowplaying";
import { pause } from "#/commands/pause";
import { ping } from "#/commands/ping";
import { play } from "#/commands/play";
import { queue } from "#/commands/queue";
import { resume } from "#/commands/resume";
import { shuffle } from "#/commands/shuffle";
import { skip } from "#/commands/skip";
import { skipTo } from "#/commands/skipto";
import { stop } from "#/commands/stop";
import type { Command, CommandContext } from "#/types";

export const commands: Command[] = [
	ping,
	play,
	pause,
	resume,
	skip,
	skipTo,
	stop,
	nowplaying,
	queue,
	shuffle,
	loop,
	help,
];

const byName = new Map<string, Command>(
	commands.flatMap((c) => [c.name, ...(c.aliases ?? [])].map((n) => [n, c])),
);

export function findCommand(name: string): Command | undefined {
	return byName.get(name.toLowerCase());
}

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
