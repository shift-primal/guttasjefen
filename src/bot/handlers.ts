import {
	type ButtonInteraction,
	type Client,
	Events,
	type Message,
} from "discord.js";
import { replyWithAI } from "#/ai/chat";
import { describeChannels, isAIChannel, isMusicChannel } from "#/bot/channels";
import { fromInteraction, fromMessage } from "#/bot/context";
import { findCommand } from "#/commands";
import { CMD_PREFIX, MUSIC_CHANNEL_KEYWORDS } from "#/constants";
import type { Command, CommandContext } from "#/types";
import { CONTROL_ID_PREFIX, handleControl } from "#/ui/controls";
import { formatArgument } from "#/ui/format";
import { handleQueuePage, QUEUE_ID_PREFIX } from "#/ui/queue";

const buttonHandlers: [string, (i: ButtonInteraction) => Promise<void>][] = [
	[CONTROL_ID_PREFIX, handleControl],
	[QUEUE_ID_PREFIX, handleQueuePage],
];

async function runCommand(command: Command, ctx: CommandContext) {
	try {
		await command.run(ctx);
	} catch (error) {
		console.error(`[command ${command.name}]`, error);
		await ctx
			.reply("Something went wrong.", { ephemeral: true })
			.catch(console.error);
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

	const parsed = parsePrefixed(message.content);
	const found = parsed && findCommand(parsed.name);
	const command = found && !found.slashOnly ? found : undefined;

	if (!parsed || !command) {
		const mentioned = message.mentions.has(message.client.user, {
			ignoreEveryone: true,
			ignoreRoles: true,
		});
		if (mentioned || isAIChannel(message.channel.name)) {
			await replyWithAI(message).catch(console.error);
		}
		return;
	}

	const ctx = fromMessage(message, parsed.args);
	if (!ctx) return;

	if (!command.anyChannel && !isMusicChannel(message.channel.name)) {
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
			const handler = buttonHandlers.find(([prefix]) =>
				interaction.customId.startsWith(prefix),
			)?.[1];
			await handler?.(interaction).catch(console.error);
			return;
		}

		if (!interaction.isChatInputCommand()) return;

		const command = findCommand(interaction.commandName);
		const ctx = command && fromInteraction(interaction, command);
		if (!command || !ctx) return;

		await runCommand(command, ctx);
	});

	client.on(Events.MessageCreate, (message) => {
		onMessage(message).catch(console.error);
	});
}
