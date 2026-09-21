import { requireQueue } from "#/commands/guards";
import { formatNowPlaying, formatTrack } from "#/format";
import type { Command } from "#/types";

const PAGE_SIZE = 10;

export const queue: Command = {
	name: "queue",
	aliases: ["q"],
	description: "Show the current queue",
	async run(ctx) {
		const activeQueue = await requireQueue(ctx, { sameChannel: false });
		if (!activeQueue) return;

		const upcoming = activeQueue.tracks.toArray();
		const lines = [formatNowPlaying(activeQueue.currentTrack), ""];

		if (upcoming.length === 0) {
			lines.push("The queue is empty.");
		} else {
			lines.push("**Up next:**");
			for (const [i, track] of upcoming.slice(0, PAGE_SIZE).entries()) {
				lines.push(`${i + 1}. ${formatTrack(track)}`);
			}
			if (upcoming.length > PAGE_SIZE) {
				lines.push(`...and ${upcoming.length - PAGE_SIZE} more`);
			}
		}

		await ctx.reply(lines.join("\n"));
	},
};
