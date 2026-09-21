import { DefaultExtractors, SpotifyExtractor } from "@discord-player/extractor";
import type { Client } from "discord.js";
import { Player } from "discord-player";
import { YoutubeExtractor } from "discord-player-youtubei";
import { env } from "#/env";
import { CustomSpotifyExtractor } from "#/extractors/spotify-extractor";

export async function setupPlayer(client: Client) {
	const player = new Player(client);

	await player.extractors.register(CustomSpotifyExtractor, {});
	await player.extractors.register(YoutubeExtractor, {});
	await player.extractors.loadMulti(
		DefaultExtractors.filter((extractor) => extractor !== SpotifyExtractor),
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

	if (env.DEBUG_PLAYER) {
		player.events.on("debug", (_queue, message) =>
			console.log("[dbg]", message),
		);
		player.on("debug", (message) => console.log("[player dbg]", message));
	}
}
