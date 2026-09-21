import { config } from "dotenv";
import { z } from "zod";

config({ path: [".env.local", ".env"] });

const runtimeSchema = z.object({
	DISCORD_TOKEN: z.string().min(1),
	DP_SPOTIFY_CLIENT_ID: z.string().optional(),
	DP_SPOTIFY_CLIENT_SECRET: z.string().optional(),
	DEBUG_PLAYER: z.string().optional(),
});

const deploySchema = z.object({
	DISCORD_TOKEN: z.string().min(1),
	CLIENT_ID: z.string().min(1),
	GUILD_ID: z.string().min(1),
});

export const env = runtimeSchema.parse(process.env);

export const deployEnv = () => deploySchema.parse(process.env);
