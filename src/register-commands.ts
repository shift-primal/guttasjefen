import { type APIGuild, REST, Routes } from "discord.js";
import { toSlashJSON } from "#/bot/slash";
import { commands } from "#/commands";
import { deployEnv } from "#/config/env";

const { DISCORD_TOKEN, CLIENT_ID } = deployEnv();

const body = commands.map(toSlashJSON);

const rest = new REST().setToken(DISCORD_TOKEN);
await rest.put(Routes.applicationCommands(CLIENT_ID), { body });

const guilds = (await rest.get(Routes.userGuilds())) as APIGuild[];
for (const guild of guilds) {
	await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guild.id), {
		body: [],
	});
}

console.log(
	`Registered ${body.length} global command(s), cleared guild commands in ${guilds.length} server(s)`,
);
