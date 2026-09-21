import { DefaultExtractors, SpotifyExtractor } from "@discord-player/extractor";
import type { Client } from "discord.js";
import { Player } from "discord-player";
import { YoutubeExtractor } from "discord-player-youtubei";
import { env } from "#/env";
import { CustomSpotifyExtractor } from "#/extractors/spotify-extractor";
import { youtubeOptions } from "#/extractors/youtube-extractor";
import { registerAnnouncements } from "#/player/announcements";

export async function setupPlayer(client: Client) {
	const player = new Player(client);

	await player.extractors.register(CustomSpotifyExtractor, {});
	await player.extractors.register(YoutubeExtractor, youtubeOptions());
	await player.extractors.loadMulti(
		DefaultExtractors.filter((extractor) => extractor !== SpotifyExtractor),
	);

	registerAnnouncements(player);

	if (env.DEBUG_PLAYER) {
		player.events.on("debug", (_queue, message) =>
			console.log("[dbg]", message),
		);
		player.on("debug", (message) => console.log("[player dbg]", message));
	}
}
