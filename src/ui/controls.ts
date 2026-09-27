import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	MessageFlags,
} from "discord.js";
import { QueueRepeatMode } from "discord-player";
import { checkQueueAccess } from "#/music/access";
import { nextRepeatMode, repeatModeInfo } from "#/music/repeat-mode";
import { skipCurrent } from "#/music/skip";

export const CONTROL_ID_PREFIX = "ctl:";

const ACTIONS = ["toggle", "skip", "stop", "shuffle", "loop"] as const;

type ControlAction = (typeof ACTIONS)[number];

export interface ControlState {
	paused: boolean;
	repeatMode: QueueRepeatMode;
}

function parseControlId(id: string): ControlAction | null {
	const action = id.slice(CONTROL_ID_PREFIX.length);
	return ACTIONS.find((known) => known === action) ?? null;
}

export function buildControls({ paused, repeatMode }: ControlState) {
	const button = (action: ControlAction, label: string, style: ButtonStyle) =>
		new ButtonBuilder()
			.setCustomId(`${CONTROL_ID_PREFIX}${action}`)
			.setLabel(label)
			.setStyle(style);

	return [
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			button("toggle", paused ? "▶️ Resume" : "⏸️ Pause", ButtonStyle.Primary),
			button("skip", "⏭️ Skip", ButtonStyle.Secondary),
			button("shuffle", "🔀 Shuffle", ButtonStyle.Secondary),
			button(
				"loop",
				`🔁 Loop: ${repeatModeInfo(repeatMode).names[0]}`,
				repeatMode === QueueRepeatMode.OFF
					? ButtonStyle.Secondary
					: ButtonStyle.Success,
			),
			button("stop", "⏹️ Stop", ButtonStyle.Danger),
		),
	];
}

async function ephemeral(interaction: ButtonInteraction, content: string) {
	await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

export async function handleControl(interaction: ButtonInteraction) {
	const action = parseControlId(interaction.customId);
	if (!action || !interaction.inCachedGuild()) return;

	const queue = checkQueueAccess(interaction.guild, interaction.member);
	if (typeof queue === "string") return ephemeral(interaction, queue);

	const refresh = async () => {
		await interaction.update({
			components: buildControls({
				paused: queue.node.isPaused(),
				repeatMode: queue.repeatMode,
			}),
		});
	};

	switch (action) {
		case "toggle":
			queue.node.setPaused(!queue.node.isPaused());
			return refresh();
		case "loop":
			queue.setRepeatMode(nextRepeatMode(queue.repeatMode));
			return refresh();
		case "shuffle":
			if (queue.tracks.size < 2) {
				return ephemeral(
					interaction,
					"Not enough tracks in the queue to shuffle.",
				);
			}
			queue.tracks.shuffle();
			return refresh();
		case "skip":
			await interaction.deferUpdate();
			skipCurrent(queue);
			return;
		case "stop":
			await interaction.update({ components: [] });
			queue.delete();
			return;
	}
}
