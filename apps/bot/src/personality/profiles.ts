import { loadProfiles, type Profiles, saveProfiles } from "@guttasjefen/db";
import { generateText } from "ai";
import { prompts, tunables } from "#/config/settings";
import { db } from "#/db";
import { parseJsonObject } from "#/helpers/text";
import { chatModel } from "#/personality/config";

export type Person = { name: string; username?: string };

const repliesSinceUpdate = new Map<string, number>();
let updating = false;

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
		? `\n\n${prompts().profilesHeader}\n${lines.join("\n")}`
		: "";
}

export async function maybeUpdateProfiles(
	channelId: string,
	transcript: string,
	people: Map<string, Person>,
) {
	const count = (repliesSinceUpdate.get(channelId) ?? 0) + 1;
	repliesSinceUpdate.set(channelId, count);
	if (count < tunables().profiles.updateEvery || updating || people.size === 0)
		return;
	repliesSinceUpdate.set(channelId, 0);
	updating = true;

	try {
		const profiles = await loadProfiles(db);
		const current = [...people]
			.map(
				([id, { name }]) =>
					`${id} (${name}): ${profiles[id]?.notes ?? "(ingen notater ennå)"}`,
			)
			.join("\n");

		const { text } = await generateText({
			model: chatModel(),
			maxOutputTokens: tunables().profiles.updateMaxTokens,
			system: prompts().profileUpdateSystem,
			prompt: `Nåværende notater:\n${current}\n\nNy chatlogg:\n${transcript}`,
		});

		const updates = parseJsonObject(text) as Record<string, unknown>;
		const changed: Profiles = {};
		for (const [id, { name }] of people) {
			const notes = updates[id];
			if (typeof notes === "string" && notes.trim()) {
				changed[id] = { name, notes: notes.trim() };
			}
		}

		await saveProfiles(db, changed);
	} catch (error) {
		console.error("Profile update failed:", error);
	} finally {
		updating = false;
	}
}
