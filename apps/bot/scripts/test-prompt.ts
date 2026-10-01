import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { addExamples, loadProfiles, loadTaste } from "@guttasjefen/db";
import { DIAL_LIMIT, withOverrides } from "@guttasjefen/db/settings";
import { prompts, refreshSettings, tunables } from "#/config/settings";
import { db } from "#/db";
import { mapLimit } from "#/helpers/async";
import { formatTime } from "#/helpers/time";
import { words } from "#/personality/filters";
import { describeLore } from "#/personality/lore";
import { describeProfiles, type Person } from "#/personality/profiles";
import { buildSystem, buildUserPrompt } from "#/personality/prompt";
import {
	generateCandidates,
	generateCandidatesTogether,
	pickBest,
} from "#/personality/reply";
import { jitterTaste, strongDials } from "#/personality/taste";

const CONCURRENCY = 6;
const BOT_NAME = /^(bot|guttasjefen)$/i;

await refreshSettings();

const { values, positionals } = parseArgs({
	allowPositionals: true,
	allowNegative: true,
	options: {
		runs: { type: "string", short: "n", default: "20" },
		count: { type: "string", multiple: true, default: [] },
		profiles: { type: "boolean", default: false },
		// Its made-up life from lore.md and the database, --no-lore to leave it out
		lore: { type: "boolean", default: true },
		"show-prompt": { type: "boolean", default: false },
		quiet: { type: "boolean", short: "q", default: false },
		temperature: { type: "string", short: "t" },
		jitter: {
			type: "string",
			short: "j",
			default: String(tunables().reply.dialJitter),
		},
		"best-of": {
			type: "string",
			short: "b",
			default: String(tunables().reply.bestOf),
		},
		verbose: { type: "boolean", short: "v", default: false },
		separate: { type: "boolean", default: false },
		dial: { type: "string", short: "d", multiple: true, default: [] },
		// on/off overrides "enabled" in the taste for this run
		taste: { type: "string" },
	},
});

type Line = { time: string; name: string; text: string; bot: boolean };

function now() {
	return formatTime(new Date());
}

function parseScenario(text: string): Line[] {
	return text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith("#"))
		.map((line) => {
			const time = line.match(/^\[(\d{2}:\d{2})\]\s*/);
			const rest = time ? line.slice(time[0].length) : line;
			const colon = rest.indexOf(":");
			if (colon === -1) throw new Error(`Line has no "name:" part: ${line}`);
			const name = rest.slice(0, colon).trim();
			return {
				time: time?.[1] ?? now(),
				name,
				text: rest.slice(colon + 1).trim(),
				bot: BOT_NAME.test(name),
			};
		});
}

async function loadScenario(arg: string | undefined) {
	if (!arg) {
		console.error(
			"Usage: pnpm test:prompt <scenario file | message> [-n 20] [-t temperature] [-b best-of] [-d dial=value ...] [--taste on|off] [-j jitter] [--separate] [-v] [--count regex] [--profiles] [--no-lore] [--show-prompt] [-q]",
		);
		process.exit(1);
	}
	const lines = existsSync(arg)
		? parseScenario(await readFile(arg, "utf8"))
		: parseScenario(`tester: ${arg}`);
	const last = lines.at(-1);
	if (!last || last.bot)
		throw new Error("The last line must be a person, not the bot");
	return { lines, last };
}

async function tasteFor(dials: string[], mode: string | undefined) {
	if (mode !== undefined && mode !== "on" && mode !== "off")
		throw new Error(`--taste must be on or off, got "${mode}"`);
	const taste = await loadTaste(db);
	if (!taste) {
		if (dials.length || mode === "on")
			throw new Error("No taste yet, run pnpm distill:taste first");
		return null;
	}
	if (mode === "off" || (mode === undefined && !taste.enabled)) {
		if (dials.length)
			throw new Error(
				"The dial system is off (taste or --taste off), so --dial does nothing. Add --taste on",
			);
		return null;
	}
	const overrides = Object.fromEntries(
		dials.map((d) => {
			const [name, value] = d.split("=");
			if (!name || !value || Number.isNaN(Number(value)))
				throw new Error(`--dial must look like name=value, got "${d}"`);
			if (Math.abs(Number(value)) > DIAL_LIMIT)
				console.warn(
					`--dial ${name}=${value} is past ±${DIAL_LIMIT}, using ${Math.sign(Number(value)) * DIAL_LIMIT}`,
				);
			return [name.trim(), Number(value)];
		}),
	);
	return withOverrides(taste, overrides);
}

async function profilesFor(lines: Line[]) {
	const all = values.profiles ? await loadProfiles(db) : {};
	const people = new Map<string, Person>();
	for (const line of lines.filter((l) => !l.bot)) {
		const name = line.name.replace(/\s*\(.*\)$/, "");
		const id = Object.entries(all).find(([, p]) => p.name === name)?.[0];
		people.set(id ?? name, { name });
	}
	return describeProfiles(all, people);
}

function isLoop(text: string) {
	const w = text.split(/\s+/);
	for (let size = 2; size * 2 <= w.length; size++) {
		for (let i = 0; i + size * 2 <= w.length; i++) {
			if (
				w.slice(i, i + size).join(" ") ===
				w.slice(i + size, i + size * 2).join(" ")
			)
				return true;
		}
	}
	return false;
}

const { lines, last } = await loadScenario(positionals[0]);
const runs = Number(values.runs);
const own = lines.filter((l) => l.bot && l.text !== "-");
// Its last few replies, plus every reply to whoever it's answering now, like the live bot
const speaker = (i: number) =>
	lines
		.slice(0, i)
		.filter((l) => !l.bot)
		.at(-1)?.name;
const shownOwn = new Set([
	...own.slice(-tunables().chat.ownRepliesShown),
	...own.filter((l) => speaker(lines.indexOf(l)) === last.name),
]);
const recentOwn = own.slice(-tunables().chat.ownRepliesShown);
const formatted = lines.map((l) => ({
	l,
	line: `[${l.time}] ${l.bot ? "Guttasjefen (deg)" : l.name}: ${l.bot && !shownOwn.has(l) ? prompts().ownReplyPlaceholder : l.text}`,
}));
const transcript = formatted.map(({ line }) => line).join("\n");
const recent = recentOwn.map((l) => l.text);
const others = formatted
	.filter(({ l }) => !l.bot)
	.map(({ line }) => line)
	.join("\n");
const name = last.name.replace(/\s*\(.*\)$/, "");
const profiles = await profilesFor(lines);
const taste = await tasteFor(values.dial, values.taste);
const lore = values.lore ? await describeLore(transcript) : "";

const bestOf = Number(values["best-of"]);
const together = !values.separate && bestOf > 1;

if (values["show-prompt"]) {
	const system = await buildSystem({
		profiles,
		taste,
		lore,
	});
	const prompt = buildUserPrompt({
		transcript,
		name,
		content: last.text,
		count: together ? bestOf : 1,
		taste: taste,
		acceptClaims: Math.random() < tunables().chat.claimAcceptChance,
	});
	console.log(`=== SYSTEM ===\n${system}\n\n=== USER ===\n${prompt}\n`);
}

const temperature = values.temperature
	? Number(values.temperature)
	: tunables().reply.temperature;
console.log(
	taste
		? `Taste: ${Object.entries(taste.dials)
				.map(([name, { value }]) => `${name}=${value}`)
				.join(
					" ",
				)}${Number(values.jitter) > 0 ? ` (each ±${values.jitter} per run, except ±${DIAL_LIMIT})` : ""}`
		: "Taste: off (random examples, no dials)",
);
console.log(
	`Running ${runs}× against "${last.text}" at temperature ${temperature}, best of ${bestOf}${together ? " (one call)" : ""}\n`,
);

let printed = 0;

const results = await mapLimit(
	Array.from({ length: runs }),
	CONCURRENCY,
	async () => {
		const wobbled = jitterTaste(taste, Number(values.jitter));
		const acceptClaims = Math.random() < tunables().chat.claimAcceptChance;
		const system = await buildSystem({
			profiles,
			taste: wobbled,
			lore,
		});
		const prompt = buildUserPrompt({
			transcript,
			name,
			content: last.text,
			count: together ? bestOf : 1,
			taste: wobbled,
			acceptClaims,
		});
		const started = performance.now();
		try {
			const content = [{ type: "text" as const, text: prompt }];
			const candidates = together
				? await generateCandidatesTogether(system, content, temperature)
				: await generateCandidates(system, content, bestOf, temperature);
			const picked = await pickBest(
				candidates.map((c) => c.reply),
				{
					transcript,
					name,
					content: last.text,
					recent,
					past: own.map((l) => l.text),
					others,
					people: profiles,
					strongDials: strongDials(wobbled),
					lore,
					acceptClaims,
				},
			);
			const { reply, finishReason } = candidates[picked] ?? {
				reply: "",
				finishReason: "error",
			};
			const number = ++printed;
			if (!values.quiet) {
				console.log(`${String(number).padStart(4)}  ${reply}`);
				if (values.verbose)
					for (const [i, c] of candidates.entries())
						if (i !== picked) console.log(`${" ".repeat(6)}✗ ${c.reply}`);
			}
			return {
				reply,
				finishReason,
				number,
				seconds: (performance.now() - started) / 1000,
			};
		} catch (error) {
			console.log(`  [error] ${(error as Error).message}`);
			return null;
		}
	},
);

const ok = results.filter((r) => r !== null);
const n = ok.length;
const pct = (count: number) => `${count}/${n}`;

console.log("\n=== Summary ===");
console.log(
	`replies: ${n}${n < runs ? ` (${runs - n} failed)` : ""}, avg ${(ok.reduce((sum, r) => sum + r.reply.split(/\s+/).length, 0) / n).toFixed(1)} words, avg ${(ok.reduce((sum, r) => sum + r.seconds, 0) / n).toFixed(1)}s per reply`,
);
const runaways = ok.filter(
	(r) => r.finishReason === "length" || isLoop(r.reply),
);
if (runaways.length)
	console.log(`loops / hit token cap: ${pct(runaways.length)}`);

const fromChat = new Set(lines.flatMap((l) => [...words(l.text)]));
const common = new Set(tunables().words.common);
const counts = new Map<string, number>();
for (const r of ok) {
	for (const w of words(r.reply)) {
		if (w.length < 4 || common.has(w)) continue;
		counts.set(w, (counts.get(w) ?? 0) + 1);
	}
}
const threshold = Math.max(3, Math.ceil(n * 0.2));
const habits = [...counts]
	.filter(([, c]) => c >= threshold)
	.sort((a, b) => b[1] - a[1]);
console.log(
	habits.length
		? `repeated words (in ≥${threshold} replies):\n${habits.map(([w, c]) => `  ${w.padEnd(16)} ${pct(c)}${fromChat.has(w) ? "  (from the chat, probably fine)" : ""}`).join("\n")}`
		: `repeated words: none in ≥${threshold} replies`,
);

for (const pattern of values.count) {
	const re = new RegExp(pattern, "i");
	console.log(
		`/${pattern}/: ${pct(ok.filter((r) => re.test(r.reply)).length)}`,
	);
}

async function rateReplies() {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const good = await rl.question(
		"\nFavourites to add to the liked examples (e.g. 3,7,12, empty to skip): ",
	);
	const bad = await rl.question(
		"Bad ones to add to the disliked examples (empty to skip): ",
	);
	rl.close();
	await saveRated(good, true);
	await saveRated(bad, false);
}

async function saveRated(answer: string, liked: boolean) {
	const numbers = new Set(
		answer
			.split(/[\s,]+/)
			.filter(Boolean)
			.map(Number),
	);
	const rated = ok
		.filter((r) => numbers.has(r.number) && r.reply)
		.map((r) => `${last.text} → ${r.reply}`);
	const added = await addExamples(db, rated, liked);
	if (added) {
		console.log(`Added ${added} ${liked ? "liked" : "disliked"} examples`);
	}
}

if (process.stdin.isTTY && !values.quiet && ok.length) await rateReplies();
await db.$client.end();
