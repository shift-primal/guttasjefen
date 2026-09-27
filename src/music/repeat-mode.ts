import { QueueRepeatMode } from "discord-player";

interface RepeatModeInfo {
	mode: QueueRepeatMode;
	// The first name is the short label shown on the loop button
	names: [string, ...string[]];
	label: string;
}

export const MODES: RepeatModeInfo[] = [
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

export function repeatModeInfo(mode: QueueRepeatMode): RepeatModeInfo {
	return MODES.find((m) => m.mode === mode) ?? (MODES[0] as RepeatModeInfo);
}

export function findRepeatMode(name: string): RepeatModeInfo | undefined {
	return MODES.find((m) => m.names.includes(name.toLowerCase()));
}

export function nextRepeatMode(current: QueueRepeatMode): QueueRepeatMode {
	return (
		CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length] ?? QueueRepeatMode.OFF
	);
}
