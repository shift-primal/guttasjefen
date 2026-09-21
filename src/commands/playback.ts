import type { VoiceBasedChannel } from "discord.js";
import {
	type GuildQueue,
	QueueRepeatMode,
	useMainPlayer,
	useQueue,
} from "discord-player";
import { requireVoiceChannel } from "#/commands/guards";
import { formatNowPlaying, formatPlaylist, formatTrack } from "#/format";
import type { CommandContext } from "#/types";

export type EnqueueMode = "end" | "next" | "now";

const NODE_OPTIONS = {
	disableVolume: true,
	disableEqualizer: true,
	disableFilterer: true,
	disableBiquad: true,
	disableResampler: true,
	disableCompressor: true,
	disableReverb: true,
	disableSeeker: true,
} as const;

export async function enqueue(ctx: CommandContext, mode: EnqueueMode) {
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
	const { track, queue, searchResult } = await useMainPlayer().play(
		voiceChannel,
		ctx.args,
		{ nodeOptions: { metadata: { channel: ctx.channel }, ...NODE_OPTIONS } },
	);
	const { playlist } = searchResult;
	const isPlayingNow = queue.currentTrack?.id === track.id;
	const position =
		queue.tracks.toArray().findIndex((t) => t.id === track.id) + 1;

	const trackLine = isPlayingNow
		? formatNowPlaying(track)
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

export function skipCurrent(queue: GuildQueue): boolean {
	if (queue.repeatMode !== QueueRepeatMode.TRACK) return queue.node.skip();

	const events = useMainPlayer().events;
	const restore = () => {
		clearTimeout(fallback);
		events.off("playerFinish", onFinish);
		queue.setRepeatMode(QueueRepeatMode.TRACK);
	};
	const onFinish = (finished: GuildQueue) => {
		if (finished.guild.id === queue.guild.id) setImmediate(restore);
	};
	const fallback = setTimeout(restore, 3000);

	queue.setRepeatMode(QueueRepeatMode.OFF);
	events.on("playerFinish", onFinish);

	const skipped = queue.node.skip();
	if (!skipped) restore();
	return skipped;
}
