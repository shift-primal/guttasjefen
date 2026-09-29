import { env } from "#/config/env";
import { AI_MESSAGES } from "#/config/prompts";

export const CMD_PREFIX = env.BOT_PREFIX ?? "-";

export const MUSIC_CHANNEL_KEYWORDS = ["bot"];
export const AI_CHANNEL_KEYWORDS = ["bot"];
export const RANDOM_REPLY_CHANNEL_KEYWORDS = ["general"];
export const RANDOM_REPLY_CHANCE = env.RANDOM_REPLY_CHANCE ?? 0.075;

export const CHAT_RESET_MARKER = AI_MESSAGES.CHAT_RESET_MARKER;
