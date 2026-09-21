import { escapeMarkdown } from "discord.js";
import type { Playlist, Track } from "discord-player";

function escapeLabel(text: string) {
	return escapeMarkdown(text).replace(/[[\]]/g, "\\$&");
}

export function formatDuration(duration: string): string | null {
	const shortened = duration.replace(/^0(?=\d)/, "");
	return shortened === "0:00" ? null : shortened;
}

function formatName(track: Track): string {
	const artist = track.author.replace(/ - Topic$/i, "").trim();
	const title = track.title.trim();

	if (!artist) return title;
	if (title.toLowerCase().startsWith(artist.toLowerCase())) return title;
	return `${artist} - ${title}`;
}

export function formatTrack(track: Track): string {
	const duration = formatDuration(track.duration);
	const label = duration
		? `${formatName(track)} - (${duration})`
		: formatName(track);

	return `[${escapeLabel(label)}](<${track.url}>)`;
}

export function formatPlaylist(playlist: Playlist): string {
	return `[${escapeLabel(playlist.title)}](<${playlist.url}>)`;
}
