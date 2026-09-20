import { config } from "dotenv";
import z from "zod";

config({ path: [".env", ".env.local"] });

const envSchema = z.object({
	DISCORD_TOKEN: z.string().min(1),
	CLIENT_ID: z.string().min(1),
	GUILD_ID: z.string().min(1),
});

export const env = envSchema.parse(process.env);
