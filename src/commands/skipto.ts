import type { Track } from "discord-player";
import { refuse, requireQueue } from "#/commands/guards";
import { formatTrack } from "#/format";
import type { Command } from "#/types";

function findTrack(tracks: Track[], input: string): Track | undefined {
	const query = input.trim().toLowerCase();

	const byId = tracks.find((track) => track.id === input.trim());
	if (byId) return byId;

	if (/^\d+$/.test(query)) {
		const byPosition = tracks[Number(query) - 1];
		if (byPosition) return byPosition;
	}

	const title = (track: Track) => track.title.toLowerCase();
	const full = (track: Track) => `${track.author} ${track.title}`.toLowerCase();

	return (
		tracks.find((track) => title(track) === query) ??
		tracks.find((track) => title(track).startsWith(query)) ??
		tracks.find((track) => full(track).includes(query))
	);
}

export const skipTo: Command = {
	name: "skipto",
	aliases: ["st", "goto"],
	description: "Skip to a track in the queue, by its number or name",
	argument: {
		name: "track",
		description: "Queue number or part of the title",
		required: true,
	},
	async run(ctx) {
		const queue = await requireQueue(ctx);
		if (!queue) return;

		const upcoming = queue.tracks.toArray();
		if (upcoming.length === 0) {
			return refuse(ctx, "There is nothing queued to skip to.");
		}

		const target = findTrack(upcoming, ctx.args);
		if (!target) {
			return refuse(
				ctx,
				`No track in the queue matches "${ctx.args}". Use its number from the queue command, or part of its title.`,
			);
		}

		if (!queue.node.skipTo(target)) {
			return refuse(ctx, "Could not skip to that track.");
		}

		const position = upcoming.indexOf(target) + 1;
		await ctx.reply(`⏭️ **Skipped to #${position}:** ${formatTrack(target)}`);
	},
};
