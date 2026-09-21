import { REST, Routes } from "discord.js";
import { config } from "dotenv";

import { commands, toSlashJSON } from "#/commands";

config({ path: [".env.local", ".env"] });

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
	throw new Error("Missing DISCORD_TOKEN, CLIENT_ID or GUILD_ID in .env");
}

const body = commands.map(toSlashJSON);

const rest = new REST().setToken(DISCORD_TOKEN);
await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });

console.log(`Registered ${body.length} command(s)`);
