import { QueueRepeatMode } from "discord-player";

export const MODES = [
	{ mode: QueueRepeatMode.OFF, names: ["off"], label: "off" },
	{
		mode: QueueRepeatMode.TRACK,
		names: ["track", "song"],
		label: "repeating the current track",
	},
	{
		mode: QueueRepeatMode.QUEUE,
		names: ["queue"],
		label: "repeating the queue",
	},
	{ mode: QueueRepeatMode.AUTOPLAY, names: ["autoplay"], label: "autoplay" },
];

const CYCLE: QueueRepeatMode[] = [
	QueueRepeatMode.OFF,
	QueueRepeatMode.TRACK,
	QueueRepeatMode.QUEUE,
];

export function nextRepeatMode(current: QueueRepeatMode): QueueRepeatMode {
	return (
		CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length] ?? QueueRepeatMode.OFF
	);
}
