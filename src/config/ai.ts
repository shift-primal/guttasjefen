export const CONFIG_DIR = "config";
export const PROFILES_PATH = "data/profiles.json";

export const MODEL = "grok-4.20-non-reasoning";

export const HISTORY_LIMIT = 15;
export const BEST_OF = 4;
export const OPENER_WORDS = 2;
export const INSULT_TAIL_CHANCE = 0.2;
export const OWN_REPLIES_SHOWN = 5;
export const EXAMPLES_PER_REPLY = 5;
export const DIAL_LIMIT = 2;
export const DIAL_JITTER = 0.5;
export const DISTILL_MAX_TOKENS = 2000;

export const UPDATE_PROFILES_EVERY = 15;
export const PROFILE_UPDATE_MAX_TOKENS = 1500;

export const JUDGE_MAX_TOKENS = 100;
export const JUDGE_TEMPERATURE = 0;

export const MAX_IMAGES = 4;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const DIRECT_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

export const REPLY_OPTIONS = {
	maxOutputTokens: 200,
	temperature: 1,
} as const;

export const COMMON_WORDS = new Set(
	"ikke bare også eller skal være sånn fordi etter over under dette hvis blir litt helt aldri alltid noen hele mens siden uten ditt mitt dine mine deres hvor hvem hvorfor hvordan kanskje fortsatt allerede faktisk igjen enda både skulle kunne ville have hadde sier gjør gjøre".split(
		" ",
	),
);
