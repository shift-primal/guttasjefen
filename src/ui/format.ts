import type { Playlist, Track } from "discord-player";
import { escapeLabel } from "#/helpers/text";
import { formatDuration } from "#/helpers/time";
import type { Command } from "#/types";

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

export function formatNowPlaying(track: Track): string {
	return `▶️ **Now playing:** ${formatTrack(track)}`;
}

export function formatArgument(argument: NonNullable<Command["argument"]>) {
	return argument.required ? `<${argument.name}>` : `[${argument.name}]`;
}
