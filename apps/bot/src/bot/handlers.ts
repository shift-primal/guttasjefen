import {
	type ButtonInteraction,
	type Client,
	Events,
	type Message,
} from "discord.js";
import { describeChannels, isMusicChannel } from "#/bot/channels";
import { fromInteraction, fromMessage } from "#/bot/context";
import { findCommand } from "#/commands";
import { CONTROL_ID_PREFIX, QUEUE_ID_PREFIX } from "#/config/music";
import { tunables } from "#/config/settings";
import { channelName } from "#/helpers/discord";
import { elapsed } from "#/helpers/time";
import { DIALS_ID_PREFIX, handleDials, maybeReply } from "#/personality";
import type { Command, CommandContext } from "#/types";
import { handleControl } from "#/ui/controls";
import { formatArgument } from "#/ui/format";
import { handleQueuePage } from "#/ui/queue";

const buttonHandlers: [string, (i: ButtonInteraction) => Promise<void>][] = [
	[CONTROL_ID_PREFIX, handleControl],
	[QUEUE_ID_PREFIX, handleQueuePage],
	[DIALS_ID_PREFIX, handleDials],
];

async function runCommand(
	command: Command,
	ctx: CommandContext,
	prefix: string,
) {
	const label = `[command ${prefix}${command.name}]`;
	const start = performance.now();
	console.log(
		`${label} ${ctx.member.displayName} in ${channelName(ctx.channel)}${ctx.args ? `: ${ctx.args}` : ""}`,
	);
	try {
		await command.run(ctx);
		console.log(`${label} done in ${elapsed(start)}`);
	} catch (error) {
		console.error(`${label} failed after ${elapsed(start)}`, error);
		await ctx
			.reply("Something went wrong.", { ephemeral: true })
			.catch(console.error);
	}
}

function parsePrefixed(content: string) {
	if (!content.startsWith(tunables().commands.prefix)) return null;

	const [name = "", ...rest] = content
		.slice(tunables().commands.prefix.length)
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
		await maybeReply(message);
		return;
	}

	const ctx = fromMessage(message, parsed.args);
	if (!ctx) return;

	if (!command.anyChannel && !isMusicChannel(message.channel.name)) {
		await ctx.reply(
			`Commands can only be used in ${describeChannels(tunables().commands.musicChannelKeywords)}.`,
		);
		return;
	}

	if (command.argument?.required && !ctx.args) {
		await ctx.reply(
			`Usage: ${tunables().commands.prefix}${command.name} ${formatArgument(command.argument)}`,
		);
		return;
	}

	await runCommand(command, ctx, tunables().commands.prefix);
}

export function registerHandlers(client: Client) {
	client.on(Events.InteractionCreate, async (interaction) => {
		if (interaction.isButton()) {
			const handler = buttonHandlers.find(([prefix]) =>
				interaction.customId.startsWith(prefix),
			)?.[1];
			console.log(
				`[button ${interaction.customId}] ${interaction.user.displayName}`,
			);
			await handler?.(interaction).catch(console.error);
			return;
		}

		if (
			interaction.isStringSelectMenu() &&
			interaction.customId.startsWith(DIALS_ID_PREFIX)
		) {
			console.log(
				`[select ${interaction.customId}] ${interaction.user.displayName}: ${interaction.values.join(", ")}`,
			);
			await handleDials(interaction).catch(console.error);
			return;
		}

		if (!interaction.isChatInputCommand()) return;

		const command = findCommand(interaction.commandName);
		const ctx = command && fromInteraction(interaction, command);
		if (!command || !ctx) return;

		await runCommand(command, ctx, "/");
	});

	client.on(Events.MessageCreate, (message) => {
		onMessage(message).catch(console.error);
	});
}
