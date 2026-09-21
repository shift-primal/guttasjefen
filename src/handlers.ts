import { type Client, Events, type Message } from "discord.js";
import { findCommand } from "#/commands";
import { CMD_PREFIX } from "#/constants";
import { fromInteraction, fromMessage } from "#/context";
import { formatArgument } from "#/format";
import type { Command, CommandContext } from "#/types";

async function runCommand(command: Command, ctx: CommandContext) {
	try {
		await command.run(ctx);
	} catch (error) {
		console.error(error);
		await ctx.reply("Something went wrong.", { ephemeral: true });
	}
}

function parsePrefixed(content: string) {
	if (!content.startsWith(CMD_PREFIX)) return null;

	const [name = "", ...rest] = content
		.slice(CMD_PREFIX.length)
		.trim()
		.split(/\s+/);
	return { name, args: rest.join(" ") };
}

async function onMessage(message: Message) {
	if (message.author.bot || !message.inGuild()) return;

	if (message.content.toLowerCase() === "hello") {
		await message.reply("Hello!");
		return;
	}

	const parsed = parsePrefixed(message.content);
	if (!parsed) return;

	const command = findCommand(parsed.name);
	const ctx = command && fromMessage(message, parsed.args);
	if (!command || !ctx) return;

	if (command.argument?.required && !ctx.args) {
		await ctx.reply(
			`Usage: ${CMD_PREFIX}${command.name} ${formatArgument(command.argument)}`,
		);
		return;
	}

	await runCommand(command, ctx);
}

export function registerHandlers(client: Client) {
	client.on(Events.InteractionCreate, async (interaction) => {
		if (!interaction.isChatInputCommand()) return;

		const command = findCommand(interaction.commandName);
		const ctx = command && fromInteraction(interaction, command);
		if (!command || !ctx) return;

		await runCommand(command, ctx);
	});

	client.on(Events.MessageCreate, onMessage);
}
