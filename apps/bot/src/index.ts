import { Client, Events, GatewayIntentBits } from "discord.js";
import { registerHandlers } from "#/bot/handlers";
import { env } from "#/config/env";
import { setupPlayer } from "#/music/setup";

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

process.on("unhandledRejection", (error) => {
	console.error("[unhandled rejection]", error);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, async () => {
		console.log(`Received ${signal}, shutting down`);
		await client.destroy();
		process.exit(0);
	});
}

await client.login(env.DISCORD_TOKEN);
