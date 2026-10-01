import { QueueRepeatMode } from "discord-player";
import { tunables } from "#/config/settings";

export const SKIP_RESTORE_TIMEOUT_MS = 3000;

export const CONTROL_ID_PREFIX = "ctl:";
export const QUEUE_ID_PREFIX = "queue:";

export const TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SPOTIFY_LINK = /^(https?:\/\/open\.spotify\.com\/|spotify:)/;
export const COOKIE_DOMAIN = /(^|\.)(youtube|google)\.com$/;

export interface RepeatModeInfo {
	mode: QueueRepeatMode;
	names: [string, ...string[]];
	label: string;
}

export const REPEAT_MODES: RepeatModeInfo[] = [
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

export const REPEAT_CYCLE: QueueRepeatMode[] = [
	QueueRepeatMode.OFF,
	QueueRepeatMode.TRACK,
	QueueRepeatMode.QUEUE,
];

export const queueOptions = () =>
	({
		disableVolume: true,
		disableEqualizer: true,
		disableFilterer: true,
		disableBiquad: true,
		disableResampler: true,
		disableCompressor: true,
		disableReverb: true,
		disableSeeker: true,
		disableFallbackStream: true,
		leaveOnEmpty: true,
		leaveOnEmptyCooldown: tunables().music.leaveOnEmptyMs,
		leaveOnEnd: true,
		leaveOnEndCooldown: tunables().music.leaveOnEndMs,
		leaveOnStop: true,
	}) as const;
