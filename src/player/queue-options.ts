import { LEAVE_ON_EMPTY_MS, LEAVE_ON_END_MS } from "#/constants";

export const QUEUE_OPTIONS = {
	disableVolume: true,
	disableEqualizer: true,
	disableFilterer: true,
	disableBiquad: true,
	disableResampler: true,
	disableCompressor: true,
	disableReverb: true,
	disableSeeker: true,
	leaveOnEmpty: true,
	leaveOnEmptyCooldown: LEAVE_ON_EMPTY_MS,
	leaveOnEnd: true,
	leaveOnEndCooldown: LEAVE_ON_END_MS,
	leaveOnStop: true,
} as const;
