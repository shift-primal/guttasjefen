import { type Client, Events, type Message } from "discord.js";
import { fromInteraction, fromMessage } from "#/bot/context";
import { findCommand } from "#/commands";
import { ALLOWED_CHANNEL_KEYWORDS, CMD_PREFIX } from "#/constants";
import type { Command, CommandContext } from "#/types";
import { handleControl } from "#/ui/controls";
import { formatArgument } from "#/ui/format";
import { handleQueuePage } from "#/ui/queue";

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

const ALLOWED_CHANNELS_TEXT = `channels with ${ALLOWED_CHANNEL_KEYWORDS.map((k) => `"${k}"`).join(", ")} in the name`;

function isAllowedChannel(name: string) {
	const lower = name.toLowerCase();
	return ALLOWED_CHANNEL_KEYWORDS.some((keyword) => lower.includes(keyword));
}

async function onMessage(message: Message) {
	if (message.author.bot || !message.inGuild()) return;

	const parsed = parsePrefixed(message.content);
	if (!parsed) return;

	const command = findCommand(parsed.name);
	const ctx = command && fromMessage(message, parsed.args);
	if (!command || !ctx) return;

	if (command.name !== "help" && !isAllowedChannel(message.channel.name)) {
		await ctx.reply(`Commands can only be used in ${ALLOWED_CHANNELS_TEXT}.`);
		return;
	}

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
		if (interaction.isButton()) {
			try {
				await handleControl(interaction);
				await handleQueuePage(interaction);
			} catch (error) {
				console.error(error);
			}
			return;
		}

		if (!interaction.isChatInputCommand()) return;

		const command = findCommand(interaction.commandName);
		const ctx = command && fromInteraction(interaction, command);
		if (!command || !ctx) return;

		await runCommand(command, ctx);
	});

	client.on(Events.MessageCreate, onMessage);
}
