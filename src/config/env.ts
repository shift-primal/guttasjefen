import { config } from "dotenv";
import { z } from "zod";

config({ path: [".env.local", ".env"] });

// Treat `KEY=` the same as a missing key, so blank lines copied from .env.example fall back to defaults
const optional = <T extends z.ZodType>(schema: T) =>
	z.preprocess(
		(value) => (value === "" ? undefined : value),
		schema.optional(),
	);

const runtimeSchema = z.object({
	XAI_API_KEY: z.string().min(1),
	DISCORD_TOKEN: z.string().min(1),
	BOT_PREFIX: optional(z.string().min(1)),
	RANDOM_REPLY_CHANCE: optional(z.coerce.number().min(0).max(1)),
	DEBUG_PLAYER: optional(z.stringbool()).default(false),
	DP_SPOTIFY_CLIENT_ID: optional(z.string()),
	DP_SPOTIFY_CLIENT_SECRET: optional(z.string()),
});

const deploySchema = z.object({
	DISCORD_TOKEN: z.string().min(1),
	CLIENT_ID: z.string().min(1),
});

export const env = runtimeSchema.parse(process.env);

export const deployEnv = () => deploySchema.parse(process.env);
