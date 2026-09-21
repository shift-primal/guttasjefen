import { PermissionsBitField } from "discord.js";
import { useMainPlayer } from "discord-player";
import { formatPlaylist, formatTrack } from "#/format";
import type { Command } from "#/types";

export const play: Command = {
	name: "play",
	aliases: ["p"],
	description: "Play a song in a voice channel",
	argument: { name: "song", description: "The song to play", required: true },
	async run(ctx) {
		const { guild, member, channel, args: query } = ctx;

		const voiceChannel = member.voice.channel;
		if (!voiceChannel) {
			await ctx.reply("You need to be in a voice channel to play music!", {
				ephemeral: true,
			});
			return;
		}

		const me = guild.members.me;
		if (me?.voice.channel && me.voice.channel !== voiceChannel) {
			await ctx.reply("I am already playing in a different voice channel!", {
				ephemeral: true,
			});
			return;
		}

		const permissions = me && voiceChannel.permissionsFor(me);
		if (
			!permissions?.has([
				PermissionsBitField.Flags.Connect,
				PermissionsBitField.Flags.Speak,
			])
		) {
			await ctx.reply(
				"I need permission to connect and speak in your voice channel!",
				{ ephemeral: true },
			);
			return;
		}

		await ctx.defer();

		try {
			const player = useMainPlayer();
			const result = await player.play(voiceChannel, query, {
				nodeOptions: {
					metadata: { channel },
					disableVolume: true,
					disableEqualizer: true,
					disableFilterer: true,
					disableBiquad: true,
					disableResampler: true,
					disableCompressor: true,
					disableReverb: true,
					disableSeeker: true,
				},
			});
			const { track, queue, searchResult } = result;
			const playlist = searchResult.playlist;
			const isPlayingNow = queue.currentTrack?.id === track.id;
			const position =
				queue.tracks.toArray().findIndex((t) => t.id === track.id) + 1;

			if (playlist) {
				await ctx.reply(
					`📃 **Added playlist** ${formatPlaylist(playlist)} · ${playlist.tracks.length} tracks\n` +
						(isPlayingNow
							? `▶️ **Now playing:** ${formatTrack(track)}`
							: `➕ **Starts at #${position}:** ${formatTrack(track)}`),
				);
			} else if (isPlayingNow) {
				await ctx.reply(`▶️ **Now playing:** ${formatTrack(track)}`);
			} else {
				await ctx.reply(
					`➕ **Added to queue (#${position}):** ${formatTrack(track)}`,
				);
			}
		} catch (error) {
			console.error(error);
			await ctx.reply("An error occurred while playing the song!");
		}
	},
};
