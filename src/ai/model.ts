import { createXai } from "@ai-sdk/xai";
import { env } from "#/env";

const xai = createXai({ apiKey: env.XAI_API_KEY });

export const model = xai("grok-4.20-non-reasoning");

export const REPLY_OPTIONS = { maxOutputTokens: 200, temperature: 1 } as const;
