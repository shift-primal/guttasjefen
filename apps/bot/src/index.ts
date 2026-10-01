import { Client, Events, GatewayIntentBits } from "discord.js";
import { registerGuildSync } from "#/bot/guilds";
import { registerHandlers } from "#/bot/handlers";
import { startSync } from "#/bot/sync";
import { env } from "#/config/env";
import { refreshSettings } from "#/config/settings";
import { setupPlayer } from "#/music/setup";
import { importFiles } from "#/personality/import-files";

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

await importFiles();
await refreshSettings();
await setupPlayer(client);
await startSync();
registerHandlers(client);
registerGuildSync(client);

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
