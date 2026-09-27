import { PermissionsBitField, type VoiceBasedChannel } from "discord.js";
import type { Track } from "discord-player";
import { type ActiveQueue, checkQueueAccess } from "#/music/access";
import { findTrack } from "#/music/find-track";
import type { CommandContext } from "#/types";

export function refuse(ctx: CommandContext, message: string) {
	return ctx.reply(message, { ephemeral: true });
}

export async function requireQueue(
	ctx: CommandContext,
	options?: { sameChannel?: boolean },
): Promise<ActiveQueue | null> {
	const queue = checkQueueAccess(ctx.guild, ctx.member, options);
	if (typeof queue !== "string") return queue;

	await refuse(ctx, queue);
	return null;
}

export async function requireUpcomingTrack(
	ctx: CommandContext,
	queue: ActiveQueue,
	action: string,
): Promise<{ track: Track; position: number } | null> {
	const upcoming = queue.tracks.toArray();
	if (upcoming.length === 0) {
		await refuse(ctx, `There is nothing queued to ${action}.`);
		return null;
	}

	const track = findTrack(upcoming, ctx.args);
	if (!track) {
		await refuse(
			ctx,
			`No track in the queue matches "${ctx.args}". Use its number from the queue command, or part of its title.`,
		);
		return null;
	}

	return { track, position: upcoming.indexOf(track) + 1 };
}

export async function requireVoiceChannel(
	ctx: CommandContext,
): Promise<VoiceBasedChannel | null> {
	const voiceChannel = ctx.member.voice.channel;
	if (!voiceChannel) {
		await refuse(ctx, "You need to be in a voice channel to play music!");
		return null;
	}

	const me = ctx.guild.members.me;
	if (me?.voice.channel && me.voice.channel !== voiceChannel) {
		await refuse(ctx, "I am already playing in a different voice channel!");
		return null;
	}

	const permissions = me && voiceChannel.permissionsFor(me);
	const canPlay = permissions?.has([
		PermissionsBitField.Flags.Connect,
		PermissionsBitField.Flags.Speak,
	]);
	if (!canPlay) {
		await refuse(
			ctx,
			"I need permission to connect and speak in your voice channel!",
		);
		return null;
	}

	return voiceChannel;
}
