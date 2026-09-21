import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
} from "discord.js";
import { type GuildQueue, useQueue } from "discord-player";
import { formatNowPlaying, formatTrack } from "#/ui/format";

const PAGE_SIZE = 10;
const ID_PREFIX = "queue:";

export function renderQueue(queue: GuildQueue, requestedPage = 1) {
	const upcoming = queue.tracks.toArray();
	const pages = Math.max(1, Math.ceil(upcoming.length / PAGE_SIZE));
	const page = Math.min(Math.max(requestedPage, 1), pages);
	const start = (page - 1) * PAGE_SIZE;

	const lines = [];
	if (queue.currentTrack) lines.push(formatNowPlaying(queue.currentTrack), "");

	if (upcoming.length === 0) {
		lines.push("The queue is empty.");
	} else {
		lines.push("**Up next:**");
		for (const [i, track] of upcoming
			.slice(start, start + PAGE_SIZE)
			.entries()) {
			lines.push(`${start + i + 1}. ${formatTrack(track)}`);
		}
	}
	if (pages > 1) {
		lines.push(`-# Page ${page}/${pages} · ${upcoming.length} tracks`);
	}

	return {
		content: lines.join("\n"),
		components: pages > 1 ? [pageButtons(page, pages)] : [],
	};
}

function pageButtons(page: number, pages: number) {
	// The slot keeps ids unique when two buttons point at the same page.
	const button = (
		slot: string,
		target: number,
		label: string,
		disabled: boolean,
	) =>
		new ButtonBuilder()
			.setCustomId(`${ID_PREFIX}${target}:${slot}`)
			.setLabel(label)
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled);

	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		button("first", 1, "⏮️", page === 1),
		button("prev", page - 1, "◀️ Prev", page === 1),
		button("next", page + 1, "Next ▶️", page === pages),
		button("last", pages, "⏭️", page === pages),
	);
}

export async function handleQueuePage(interaction: ButtonInteraction) {
	if (!interaction.customId.startsWith(ID_PREFIX)) return;

	const page = Number(
		interaction.customId.slice(ID_PREFIX.length).split(":")[0],
	);
	if (!Number.isInteger(page) || !interaction.inCachedGuild()) return;

	const queue = useQueue(interaction.guild);
	if (!queue) {
		await interaction.update({
			content: "The queue is gone.",
			components: [],
		});
		return;
	}

	await interaction.update(renderQueue(queue, page));
}
