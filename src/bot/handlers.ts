import { type Client, Events, type Message } from "discord.js";
import { replyWithAI } from "#/ai/chat";
import { describeChannels, isAIChannel, isMusicChannel } from "#/bot/channels";
import { fromInteraction, fromMessage } from "#/bot/context";
import { findCommand } from "#/commands";
import { CMD_PREFIX, MUSIC_CHANNEL_KEYWORDS } from "#/constants";
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

async function onMessage(message: Message) {
	if (message.author.bot || !message.inGuild()) return;

	const mentioned = message.mentions.has(message.client.user, {
		ignoreEveryone: true,
		ignoreRoles: true,
	});
	const parsed = parsePrefixed(message.content);
	const command = parsed && findCommand(parsed.name);

	if (!command) {
		if (mentioned || isAIChannel(message.channel.name)) {
			await replyWithAI(message).catch(console.error);
		}
		return;
	}

	const ctx = fromMessage(message, parsed.args);
	if (!ctx) return;

	if (command.name !== "help" && !isMusicChannel(message.channel.name)) {
		await ctx.reply(
			`Commands can only be used in ${describeChannels(MUSIC_CHANNEL_KEYWORDS)}.`,
		);
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
