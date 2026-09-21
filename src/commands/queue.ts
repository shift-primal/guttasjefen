import { requireQueue } from "#/commands/queue-guard";
import type { Command } from "#/types";

const PAGE_SIZE = 10;

export const queue: Command = {
	name: "queue",
	aliases: ["q"],
	description: "Show the current queue",
	async run(ctx) {
		const guildQueue = await requireQueue(ctx, { sameChannel: false });
		if (!guildQueue?.currentTrack) return;

		const upcoming = guildQueue.tracks.toArray();
		const lines = [
			`Now playing: **${guildQueue.currentTrack.title}** (${guildQueue.currentTrack.duration})`,
		];

		if (upcoming.length === 0) {
			lines.push("", "The queue is empty.");
		} else {
			lines.push("", "Up next:");
			for (const [i, track] of upcoming.slice(0, PAGE_SIZE).entries()) {
				lines.push(`${i + 1}. ${track.title} (${track.duration})`);
			}
			if (upcoming.length > PAGE_SIZE) {
				lines.push(`...and ${upcoming.length - PAGE_SIZE} more`);
			}
		}

		await ctx.reply(lines.join("\n"));
	},
};
