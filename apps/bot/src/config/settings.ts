import { readSetting } from "@guttasjefen/db";
import {
	type Personality,
	type Prompts,
	personalitySchema,
	promptsSchema,
	type Tunables,
	tunablesSchema,
} from "@guttasjefen/db/settings";
import { db } from "#/db";

const cached = {
	tunables: tunablesSchema.parse({}) as Tunables,
	prompts: promptsSchema.parse({}) as Prompts,
	personality: personalitySchema.parse({}) as Personality,
};

export type CachedSetting = keyof typeof cached;

export const isCachedSetting = (key: string): key is CachedSetting =>
	key in cached;

export const tunables = () => cached.tunables;
export const prompts = () => cached.prompts;
export const personality = () => cached.personality;

export async function refreshSettings(
	keys = Object.keys(cached) as CachedSetting[],
) {
	await Promise.all(
		keys.map(async (key) => {
			Object.assign(cached, { [key]: await readSetting(db, key) });
		}),
	);
}
