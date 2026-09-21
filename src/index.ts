import { Client, Events, GatewayIntentBits } from "discord.js";
import { registerHandlers } from "#/bot/handlers";
import { env } from "#/env";
import { setupPlayer } from "#/player";

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

await setupPlayer(client);
registerHandlers(client);

client.once(Events.ClientReady, (c) => {
	console.log(`Logged in as ${c.user.tag}`);
});

await client.login(env.DISCORD_TOKEN);
