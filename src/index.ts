import { DefaultExtractors } from "@discord-player/extractor";
import { Client, Collection, Events, GatewayIntentBits } from "discord.js";
import { Player } from "discord-player";
import { YoutubeExtractor } from "discord-player-youtubei";
import { config } from "dotenv";

import { ping } from "#/commands/ping";
import type { Command } from "#/types";

config({ path: [".env.local", ".env"] });

const TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const player = new Player(client);
await player.extractors.register(YoutubeExtractor, {});
await player.extractors.loadMulti(DefaultExtractors);

const commands = new Collection<string, Command>([[ping.data.name, ping]]);

client.once(Events.ClientReady, (c) => {
	console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	const command = commands.get(interaction.commandName);
	if (!command) return;

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		const reply = { content: "Something went wrong.", ephemeral: true };
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp(reply);
		} else {
			await interaction.reply(reply);
		}
	}
});

await client.login(TOKEN);
