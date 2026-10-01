import { loadExamples } from "@guttasjefen/db";
import {
	clampDial,
	DIAL_LIMIT,
	type Tags,
	type Taste,
} from "@guttasjefen/db/settings";
import { personality, prompts, tunables } from "#/config/settings";
import { db } from "#/db";
import { pickRandom } from "#/helpers/random";
import { fill } from "#/helpers/text";
import {
	describeTaste,
	hasStrongLengthDial,
	strongDials,
} from "#/personality/taste";

// The message half of "message → reply", so two replies to the same message count as one
function exampleMessage(entry: string): string {
	const [message] = entry.split("→");
	return (message ?? entry).trim().toLowerCase();
}

function formatExample(entry: string): string {
	const [message, reply] = entry.split("→").map((part) => part.trim());
	return reply ? `- ${message} → ${reply}` : `- ${entry}`;
}

// Random examples, never two replies to the same message
function pickDistinct(entries: string[], count: number) {
	const seen = new Set<string>();
	return pickRandom(entries, entries.length)
		.filter((entry) => {
			const message = exampleMessage(entry);
			if (seen.has(message)) return false;
			seen.add(message);
			return true;
		})
		.slice(0, count);
}

function weight(tags: Record<string, number>, taste: Taste) {
	let distance = 0;
	for (const [name, { value }] of Object.entries(taste.dials)) {
		const tagged = tags[name];
		const pull = Math.abs(clampDial(value)) / DIAL_LIMIT;
		if (tagged !== undefined) distance += pull * (tagged - value) ** 2;
	}
	return Math.exp(-distance / 2);
}

// Random examples weighted toward the ones tagged closest to the current dials
function pickExamples(
	entries: string[],
	tags: Tags,
	taste: Taste,
	count: number,
): string[] {
	const weights = entries.map((e) => {
		const t = tags[e];
		return t ? weight(t, taste) : undefined;
	});
	const tagged = weights.filter((w) => w !== undefined);
	const fallback = tagged.length
		? tagged.reduce((sum, w) => sum + w, 0) / tagged.length
		: 1;
	const pool = entries.map((entry, i) => ({
		entry,
		weight: weights[i] ?? fallback,
	}));

	const picked: string[] = [];
	while (picked.length < count && pool.length) {
		const total = pool.reduce((sum, p) => sum + p.weight, 0);
		const roll = Math.random() * total;
		let index = 0;
		for (let sum = 0; index < pool.length - 1; index++) {
			sum += pool[index]?.weight ?? 0;
			if (sum >= roll) break;
		}
		const chosen = pool[index];
		if (!chosen) break;
		picked.push(chosen.entry);
		// Never two replies to the same message in one prompt
		const message = exampleMessage(chosen.entry);
		for (let i = pool.length - 1; i >= 0; i--) {
			if (exampleMessage((pool[i] as { entry: string }).entry) === message)
				pool.splice(i, 1);
		}
	}
	return picked;
}

export async function buildSystem({
	profiles,
	taste,
	lore = "",
}: {
	profiles: string;
	taste: Taste | null;
	// Its life so far, from describeLore
	lore?: string;
}) {
	const { persona, chatRules } = personality();
	const examples = await loadExamples(db, true);
	const entries = examples.map(({ text }) => text);
	const tags: Tags = Object.fromEntries(
		examples.flatMap(({ text, tags }) => (tags ? [[text, tags]] : [])),
	);
	const shown = taste
		? pickExamples(entries, tags, taste, tunables().chat.examplesPerReply)
		: pickDistinct(entries, tunables().chat.examplesPerReply);
	const tasteText = describeTaste(taste);
	const tasteSection = tasteText
		? `${prompts().tasteHeader}\n\n${tasteText}`
		: "";

	const examplesSection = shown.length
		? `${prompts().examplesHeader}\n\n${shown.map(formatExample).join("\n")}`
		: "";

	return [
		persona.trim(),
		chatRules.trim() + profiles,
		lore ? `${prompts().loreHeader}\n\n${lore}` : "",
		tasteSection,
		examplesSection,
	]
		.filter(Boolean)
		.join("\n\n");
}

function claimInstruction(accept: boolean, count: number) {
	const p = prompts();
	if (accept) return count > 1 ? p.claimAcceptMulti : p.claimAcceptSingle;
	return count > 1 ? p.claimRejectMulti : p.claimRejectSingle;
}

function strongDialsInstruction(dials: string[], count: number) {
	const template =
		count > 1 ? prompts().strongDialsMulti : prompts().strongDialsSingle;
	return fill(template, { dials: dials.map((d) => `«${d}»`).join(", ") });
}

export function buildUserPrompt({
	transcript,
	name,
	content,
	count = 1,
	taste = null,
	thread,
	acceptClaims,
}: {
	transcript: string;
	name: string;
	content: string;
	count?: number;
	taste?: Taste | null;
	// Earlier messages in the reply chain they're in, older than the chat log
	thread?: string;
	// Whether it goes along with made-up claims about its life this time
	acceptClaims: boolean;
}) {
	const instruction =
		count > 1 ? fill(prompts().replyMulti, { count }) : prompts().replySingle;
	const strong = strongDials(taste);
	return [
		thread ? `Samtalen du er i, fra før chatloggen:\n${thread}` : "",
		`Chatlogg:\n${transcript}`,
		`Du svarer nå ${name}. Meldingen deres: ${content}`,
		hasStrongLengthDial(taste)
			? ""
			: count > 1
				? prompts().lengthMulti
				: prompts().lengthSingle,
		instruction,
		claimInstruction(acceptClaims, count),
		strong.length ? strongDialsInstruction(strong, count) : "",
	]
		.filter(Boolean)
		.join("\n\n");
}
