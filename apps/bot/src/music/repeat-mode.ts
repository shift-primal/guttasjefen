import { QueueRepeatMode } from "discord-player";
import {
	REPEAT_CYCLE,
	REPEAT_MODES,
	type RepeatModeInfo,
} from "#/config/music";

export function repeatModeInfo(mode: QueueRepeatMode): RepeatModeInfo {
	return (
		REPEAT_MODES.find((m) => m.mode === mode) ??
		(REPEAT_MODES[0] as RepeatModeInfo)
	);
}

export function findRepeatMode(name: string): RepeatModeInfo | undefined {
	return REPEAT_MODES.find((m) => m.names.includes(name.toLowerCase()));
}

export function nextRepeatMode(current: QueueRepeatMode): QueueRepeatMode {
	return (
		REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(current) + 1) % REPEAT_CYCLE.length] ??
		QueueRepeatMode.OFF
	);
}
