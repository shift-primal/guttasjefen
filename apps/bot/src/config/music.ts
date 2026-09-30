import { QueueRepeatMode } from "discord-player";
import { rootPath } from "#/helpers/fs";

export const LEAVE_ON_EMPTY_MS = 60_000;
export const LEAVE_ON_END_MS = 5 * 60_000;
export const MAX_TRACK_RETRIES = 1;
export const SKIP_RESTORE_TIMEOUT_MS = 3000;

export const PAGE_SIZE = 10;
export const CONTROL_ID_PREFIX = "ctl:";
export const QUEUE_ID_PREFIX = "queue:";

export const COOKIES_PATH = rootPath("config/music/cookies.txt");
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

export const QUEUE_OPTIONS = {
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
	leaveOnEmptyCooldown: LEAVE_ON_EMPTY_MS,
	leaveOnEnd: true,
	leaveOnEndCooldown: LEAVE_ON_END_MS,
	leaveOnStop: true,
} as const;
