import { createXai } from "@ai-sdk/xai";
import { env } from "#/config/env";
import { tunables } from "#/config/settings";

const xai = createXai({ apiKey: env.XAI_API_KEY });
export const chatModel = () => xai(tunables().chat.model);

// Discord drops "is typing…" after 10 seconds
export const TYPING_REFRESH_MS = 8000;
export const DIALS_ID_PREFIX = "dials:";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const DIRECT_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
