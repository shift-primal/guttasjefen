import { createXai } from "@ai-sdk/xai";
import { MODEL } from "#/config/ai";
import { env } from "#/config/env";

const xai = createXai({ apiKey: env.XAI_API_KEY });

export const model = xai(MODEL);
