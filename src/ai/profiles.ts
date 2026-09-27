import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { generateText, type LanguageModel } from "ai";

const PROFILES_PATH = "data/profiles.json";
const UPDATE_EVERY = 15;

export type Profile = { name: string; notes: string };
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

export function describeProfiles(profiles: Profiles, userIds: Set<string>) {
	const lines = [...userIds]
		.map((id) => profiles[id])
		.filter((p): p is Profile => Boolean(p?.notes))
		.map((p) => `- ${p.name}: ${p.notes}`);
	return lines.length ? `\n\n## Folk du kjenner\n${lines.join("\n")}` : "";
}

export async function maybeUpdateProfiles(
	model: LanguageModel,
	channelId: string,
	transcript: string,
	people: Map<string, string>,
) {
	const count = (repliesSinceUpdate.get(channelId) ?? 0) + 1;
	repliesSinceUpdate.set(channelId, count);
	if (count < UPDATE_EVERY || updating || people.size === 0) return;
	repliesSinceUpdate.set(channelId, 0);
	updating = true;

	try {
		const profiles = await loadProfiles();
		const current = [...people]
			.map(
				([id, name]) =>
					`${id} (${name}): ${profiles[id]?.notes ?? "(ingen notater ennå)"}`,
			)
			.join("\n");

		const { text } = await generateText({
			model,
			maxOutputTokens: 1500,
			system:
				'Du holder korte notater om folk i en Discord-chat, så en roast-bot kan kjenne dem igjen. Skriv på norsk. Notér ting som er spesifikke for hver person: hva de snakker om, vaner, meninger, ting de har sagt eller gjort, hvordan de skriver. Maks 30 ord per person. Behold gamle notater som fortsatt stemmer. Svar KUN med JSON: {"<bruker-id>": "notater"}.',
			prompt: `Nåværende notater:\n${current}\n\nNy chatlogg:\n${transcript}`,
		});

		const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
		const updates: Record<string, unknown> = JSON.parse(json);
		for (const [id, name] of people) {
			const notes = updates[id];
			if (typeof notes === "string" && notes.trim()) {
				profiles[id] = { name, notes: notes.trim() };
			}
		}

		await mkdir(dirname(PROFILES_PATH), { recursive: true });
		await writeFile(PROFILES_PATH, JSON.stringify(profiles, null, "\t"));
	} catch (error) {
		console.error("Profile update failed:", error);
	} finally {
		updating = false;
	}
}
