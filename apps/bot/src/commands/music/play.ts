import type { VoiceBasedChannel } from "discord.js";
import { type GuildQueue, useMainPlayer, useQueue } from "discord-player";
import { requireVoiceChannel } from "#/commands/guards";
import { queueOptions } from "#/config/music";
import { skipCurrent } from "#/music/skip";
import type { Command, CommandContext, QueueMetadata } from "#/types";
import { formatPlaylist, formatTrack } from "#/ui/format";

type EnqueueMode = "end" | "next" | "now";

export const play: Command = {
	name: "play",
	aliases: ["p"],
	description: "Play a song in a voice channel",
	argument: { name: "song", description: "The song to play", required: true },
	run: (ctx) => enqueue(ctx, "end"),
};

export const playNext: Command = {
	name: "playnext",
	aliases: ["pn"],
	description:
		"Put a song at the top of the queue, without skipping the current one",
	argument: {
		name: "song",
		description: "The song to play next",
		required: true,
	},
	run: (ctx) => enqueue(ctx, "next"),
};

export const playNow: Command = {
	name: "playnow",
	aliases: ["pnow"],
	description: "Skip the current song and play this one now, keeping the queue",
	argument: {
		name: "song",
		description: "The song to play right now",
		required: true,
	},
	run: (ctx) => enqueue(ctx, "now"),
};

async function enqueue(ctx: CommandContext, mode: EnqueueMode) {
	const voiceChannel = await requireVoiceChannel(ctx);
	if (!voiceChannel) return;

	await ctx.defer();

	try {
		const queue = useQueue(ctx.guild);

		if (mode === "end" || !queue?.currentTrack) {
			await playAtEnd(ctx, voiceChannel);
		} else {
			await playAhead(ctx, queue, mode);
		}
	} catch (error) {
		console.error(error);
		await ctx.reply("An error occurred while playing the song!");
	}
}

async function playAtEnd(ctx: CommandContext, voiceChannel: VoiceBasedChannel) {
	const metadata: QueueMetadata = { channel: ctx.channel };
	const { track, queue, searchResult } = await useMainPlayer().play(
		voiceChannel,
		ctx.args,
		{
			requestedBy: ctx.member.user,
			nodeOptions: { metadata, ...queueOptions() },
		},
	);
	const { playlist } = searchResult;
	const isPlayingNow = queue.currentTrack?.id === track.id;
	const position =
		queue.tracks.toArray().findIndex((t) => t.id === track.id) + 1;

	const trackLine = isPlayingNow
		? `🔎 **Loaded:** ${formatTrack(track)}`
		: `➕ **${playlist ? "Starts at" : "Added to queue"} #${position}:** ${formatTrack(track)}`;

	await ctx.reply(
		playlist
			? `📃 **Added playlist** ${formatPlaylist(playlist)} · ${playlist.tracks.length} tracks\n${trackLine}`
			: trackLine,
	);
}

async function playAhead(
	ctx: CommandContext,
	queue: GuildQueue,
	mode: "next" | "now",
) {
	const search = await useMainPlayer().search(ctx.args, {
		requestedBy: ctx.member.user,
	});
	if (!search.hasTracks()) {
		await ctx.reply(`No results found for "${ctx.args}".`);
		return;
	}

	const { playlist } = search;
	const tracks = playlist ? search.tracks : search.tracks.slice(0, 1);
	const [first] = tracks;
	if (!first) return;

	tracks.forEach((track, index) => {
		queue.insertTrack(track, index);
	});
	if (mode === "now") skipCurrent(queue);

	const label = mode === "now" ? "▶️ **Playing now:**" : "⏭️ **Playing next:**";
	const lines = [`${label} ${formatTrack(first)}`];
	if (playlist) {
		lines.unshift(
			`📃 **Added playlist** ${formatPlaylist(playlist)} · ${tracks.length} tracks at the top of the queue`,
		);
	}
	await ctx.reply(lines.join("\n"));
}
