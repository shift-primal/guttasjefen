import { REST, Routes } from "discord.js";
import { commands } from "#/commands";
import { toSlashJSON } from "#/commands/slash";
import { deployEnv } from "#/env";

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = deployEnv();

const body = commands.map(toSlashJSON);

const rest = new REST().setToken(DISCORD_TOKEN);
await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });

console.log(`Registered ${body.length} command(s)`);
