import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	MessageFlags,
} from "discord.js";
import { QueueRepeatMode, useQueue } from "discord-player";
import { nextRepeatMode } from "#/player/repeat-mode";
import { skipCurrent } from "#/player/skip";

const ID_PREFIX = "ctl:";

export type ControlAction = "toggle" | "skip" | "stop" | "shuffle" | "loop";

const ACTIONS: readonly ControlAction[] = [
	"toggle",
	"skip",
	"stop",
	"shuffle",
	"loop",
];

const LOOP_LABELS: Record<QueueRepeatMode, string> = {
	[QueueRepeatMode.OFF]: "off",
	[QueueRepeatMode.TRACK]: "track",
	[QueueRepeatMode.QUEUE]: "queue",
	[QueueRepeatMode.AUTOPLAY]: "autoplay",
};

export interface ControlState {
	paused: boolean;
	repeatMode: QueueRepeatMode;
}

export function parseControlId(id: string): ControlAction | null {
	if (!id.startsWith(ID_PREFIX)) return null;
	const action = id.slice(ID_PREFIX.length);
	return ACTIONS.find((known) => known === action) ?? null;
}

export function buildControls({ paused, repeatMode }: ControlState) {
	const button = (action: ControlAction, label: string, style: ButtonStyle) =>
		new ButtonBuilder()
			.setCustomId(`${ID_PREFIX}${action}`)
			.setLabel(label)
			.setStyle(style);

	return [
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			button("toggle", paused ? "▶️ Resume" : "⏸️ Pause", ButtonStyle.Primary),
			button("skip", "⏭️ Skip", ButtonStyle.Secondary),
			button("shuffle", "🔀 Shuffle", ButtonStyle.Secondary),
			button(
				"loop",
				`🔁 Loop: ${LOOP_LABELS[repeatMode]}`,
				repeatMode === QueueRepeatMode.OFF
					? ButtonStyle.Secondary
					: ButtonStyle.Success,
			),
			button("stop", "⏹️ Stop", ButtonStyle.Danger),
		),
	];
}

function ephemeral(interaction: ButtonInteraction, content: string) {
	return interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

export async function handleControl(interaction: ButtonInteraction) {
	const action = parseControlId(interaction.customId);
	if (!action || !interaction.inCachedGuild()) return;

	const queue = useQueue(interaction.guild);
	if (!queue?.currentTrack) {
		await ephemeral(interaction, "Nothing is playing right now.");
		return;
	}
	if (interaction.member.voice.channelId !== queue.channel?.id) {
		await ephemeral(
			interaction,
			"You need to be in my voice channel to do that!",
		);
		return;
	}

	const refresh = () =>
		interaction.update({
			components: buildControls({
				paused: queue.node.isPaused(),
				repeatMode: queue.repeatMode,
			}),
		});

	switch (action) {
		case "toggle":
			queue.node.setPaused(!queue.node.isPaused());
			await refresh();
			break;
		case "loop":
			queue.setRepeatMode(nextRepeatMode(queue.repeatMode));
			await refresh();
			break;
		case "shuffle":
			if (queue.tracks.size < 2) {
				await ephemeral(
					interaction,
					"Not enough tracks in the queue to shuffle.",
				);
				return;
			}
			queue.tracks.shuffle();
			await refresh();
			break;
		case "skip":
			await interaction.deferUpdate();
			skipCurrent(queue);
			break;
		case "stop":
			await interaction.update({ components: [] });
			queue.delete();
			break;
	}
}
