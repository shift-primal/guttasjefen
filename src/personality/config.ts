import { createXai } from "@ai-sdk/xai";
import { env } from "#/config/env";

// Hand-written persona, rules and examples, plus taste/ written by `pnpm distill:taste`
export const PERSONALITY_CONFIG_DIR = "config/personality";
export const PROFILES_PATH = "data/profiles.json";
export const DIAL_OVERRIDES_PATH = "data/dials.json";
// The life it has made up for itself while chatting, on top of lore.md
export const LORE_PATH = "data/lore.json";

export const model = createXai({ apiKey: env.XAI_API_KEY })(
	"grok-4.20-non-reasoning",
);

// Where it talks: every message in AI channels, now and then in random-reply channels
export const AI_CHANNEL_KEYWORDS = ["bot", "chat"];
export const RANDOM_REPLY_CHANNEL_KEYWORDS = ["general"];
export const RANDOM_REPLY_CHANCE = env.RANDOM_REPLY_CHANCE ?? 0.25;

export const HISTORY_LIMIT = 25;
// Messages after the one it's answering, sent while it waited for its turn
export const LATER_LIMIT = 10;
// How long a reply waits for the one before it in the same channel before going anyway
export const TURN_WAIT_LIMIT_MS = 8000;
// Discord drops "is typing…" after 10 seconds
export const TYPING_REFRESH_MS = 8000;
export const BEST_OF = 4;
export const OPENER_WORDS = 2;
export const INSULT_TAIL_CHANCE = 0.2;
export const OWN_REPLIES_SHOWN = 5;
export const EXAMPLES_PER_REPLY = 5;
export const DIAL_LIMIT = 2;
export const DIAL_JITTER = 0.5;
export const DIAL_STEP = 0.5;
export const DIALS_ID_PREFIX = "dials:";
// Only members with this role can use the dials and lore commands
export const DEV_ROLE = "dev";
export const DISTILL_MAX_TOKENS = 2000;

// How far back it follows a chain of replies, past the chat log
export const THREAD_LIMIT = 12;

// Most learned lore entries shown per reply, the ones the chat mentions first
export const LORE_SHOWN = 25;
export const LORE_UPDATE_MAX_TOKENS = 800;
// Chat lines the lore update reads around each reply, to know what "ja" agreed to
export const LORE_CONTEXT_LINES = 8;
// How often it goes along when someone makes up something about its life
// ("din kusine som bor i narvik"), which then becomes part of its lore
export const CLAIM_ACCEPT_CHANCE = 0.4;

export const UPDATE_PROFILES_EVERY = 15;
export const PROFILE_UPDATE_MAX_TOKENS = 1500;

export const JUDGE_MAX_TOKENS = 300;
export const JUDGE_TEMPERATURE = 0;

export const MAX_IMAGES = 4;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const DIRECT_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

export const REPLY_OPTIONS = {
	maxOutputTokens: 300,
	temperature: 1,
} as const;

export const COMMON_WORDS = new Set(
	"ikke bare også eller skal være sånn fordi etter over under dette hvis blir litt helt aldri alltid noen hele mens siden uten ditt mitt dine mine deres hvor hvem hvorfor hvordan kanskje fortsatt allerede faktisk igjen enda både skulle kunne ville have hadde sier gjør gjøre".split(
		" ",
	),
);
