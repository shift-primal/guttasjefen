import { REST, Routes } from "discord.js";
import { config } from "dotenv";

import { ping } from "#/commands/ping";

config({ path: [".env.local", ".env"] });

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
	throw new Error("Missing DISCORD_TOKEN, CLIENT_ID or GUILD_ID in .env");
}

const commands = [ping].map((c) => c.data.toJSON());

const rest = new REST().setToken(DISCORD_TOKEN);
await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
	body: commands,
});

console.log(`Registered ${commands.length} command(s)`);
