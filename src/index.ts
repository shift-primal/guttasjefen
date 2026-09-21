import { DefaultExtractors, SpotifyExtractor } from "@discord-player/extractor";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { Player } from "discord-player";
import { YoutubeExtractor } from "discord-player-youtubei";
import { config } from "dotenv";
import { findCommand, runCommand } from "#/commands";
import { fromInteraction, fromMessage } from "#/context";
import { CustomSpotifyExtractor } from "#/extractors/spotify-extractor";

config({ path: [".env.local", ".env"] });

const TOKEN = process.env.DISCORD_TOKEN;

const CMD_PREFIX = "-";

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

const player = new Player(client);

await player.extractors.register(CustomSpotifyExtractor, {});
await player.extractors.register(YoutubeExtractor, {});
await player.extractors.loadMulti(
	DefaultExtractors.filter((e) => e !== SpotifyExtractor),
);

player.events.on("error", (_queue, error) => {
	console.error("[queue error]", error);
});

player.events.on("playerError", (_queue, error, track) => {
	console.error(`[player error] ${track.title}`, error);
});

player.events.on("playerStart", (_queue, track) => {
	console.log(`[start] ${track.title}`);
});

player.events.on("playerFinish", (_queue, track) => {
	console.log(`[finish] ${track.title}`);
});

player.events.on("emptyQueue", () => console.log("[queue] empty"));

player.events.on("disconnect", () => console.log("[voice] disconnected"));

player.events.on("connectionDestroyed", () =>
	console.log("[voice] connection destroyed"),
);

if (process.env.DEBUG_PLAYER) {
	player.events.on("debug", (_queue, message) => console.log("[dbg]", message));
	player.on("debug", (message) => console.log("[player dbg]", message));
}

client.once(Events.ClientReady, (c) => {
	console.log(`Logged in as ${c.user.tag}`);
});

// `/cmd`
client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	const command = findCommand(interaction.commandName);
	const ctx = command && fromInteraction(interaction, command);
	if (!command || !ctx) return;

	await runCommand(command, ctx);
});

// `-cmd` and plain keyword replies
client.on(Events.MessageCreate, async (message) => {
	if (message.author.bot || !message.inGuild()) return;

	if (message.content.toLowerCase() === "hello") {
		await message.reply("Hello!");
		return;
	}

	if (!message.content.startsWith(CMD_PREFIX)) return;

	const [name = "", ...rest] = message.content
		.slice(CMD_PREFIX.length)
		.trim()
		.split(/\s+/);
	const command = findCommand(name);
	const ctx = command && fromMessage(message, rest.join(" "));
	if (!command || !ctx) return;

	if (command.argument?.required && !ctx.args) {
		await ctx.reply(
			`Usage: ${CMD_PREFIX}${command.name} <${command.argument.name}>`,
		);
		return;
	}

	await runCommand(command, ctx);
});

await client.login(TOKEN);
