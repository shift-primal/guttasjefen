import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { generateText, type LanguageModel } from "ai";
import {
	PROFILE_UPDATE_MAX_TOKENS,
	PROFILES_PATH,
	UPDATE_PROFILES_EVERY,
} from "#/config/ai";
import {
	PROFILE_UPDATE_SYSTEM,
	PROFILES_SECTION_HEADER,
} from "#/config/prompts";

export type Profile = { name: string; notes: string };
export type Person = { name: string; username?: string };
type Profiles = Record<string, Profile>;

const repliesSinceUpdate = new Map<string, number>();
let updating = false;

export async function loadProfiles(): Promise<Profiles> {
	try {
		return JSON.parse(await readFile(PROFILES_PATH, "utf8"));
	} catch {
		return {};
	}
}

async function saveProfiles(profiles: Profiles) {
	await mkdir(dirname(PROFILES_PATH), { recursive: true });
	await writeFile(PROFILES_PATH, JSON.stringify(profiles, null, "\t"));
}

export async function clearProfile(userId: string) {
	const profiles = await loadProfiles();
	if (!(userId in profiles)) return false;
	delete profiles[userId];
	await saveProfiles(profiles);
	return true;
}

export function describeProfiles(
	profiles: Profiles,
	people: Map<string, Person>,
) {
	const lines = [...people].map(([id, { name, username }]) => {
		const tag =
			username && username.toLowerCase() !== name.toLowerCase()
				? ` (brukernavn ${username})`
				: "";
		const notes = profiles[id]?.notes;
		return `- ${name}${tag}${notes ? `: ${notes}` : ""}`;
	});
	return lines.length
		? `\n\n${PROFILES_SECTION_HEADER}\n${lines.join("\n")}`
		: "";
}

export async function maybeUpdateProfiles(
	model: LanguageModel,
	channelId: string,
	transcript: string,
	people: Map<string, Person>,
) {
	const count = (repliesSinceUpdate.get(channelId) ?? 0) + 1;
	repliesSinceUpdate.set(channelId, count);
	if (count < UPDATE_PROFILES_EVERY || updating || people.size === 0) return;
	repliesSinceUpdate.set(channelId, 0);
	updating = true;

	try {
		const profiles = await loadProfiles();
		const current = [...people]
			.map(
				([id, { name }]) =>
					`${id} (${name}): ${profiles[id]?.notes ?? "(ingen notater ennå)"}`,
			)
			.join("\n");

		const { text } = await generateText({
			model,
			maxOutputTokens: PROFILE_UPDATE_MAX_TOKENS,
			system: PROFILE_UPDATE_SYSTEM,
			prompt: `Nåværende notater:\n${current}\n\nNy chatlogg:\n${transcript}`,
		});

		const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
		const updates: Record<string, unknown> = JSON.parse(json);
		const latest = await loadProfiles();
		for (const [id, { name }] of people) {
			const notes = updates[id];
			if (typeof notes === "string" && notes.trim()) {
				latest[id] = { name, notes: notes.trim() };
			}
		}

		await saveProfiles(latest);
	} catch (error) {
		console.error("Profile update failed:", error);
	} finally {
		updating = false;
	}
}
