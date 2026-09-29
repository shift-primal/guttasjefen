import { existsSync } from "node:fs";
import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { describeProfiles, loadProfiles, type Person } from "#/ai/profiles";
import { buildSystem, buildUserPrompt } from "#/ai/prompt";
import {
	generateCandidates,
	generateCandidatesTogether,
	pickBest,
} from "#/ai/reply";
import { jitterTaste, loadTaste, strongDials, withOverrides } from "#/ai/taste";
import {
	BEST_OF,
	COMMON_WORDS,
	CONFIG_DIR,
	DIAL_JITTER,
	DIAL_LIMIT,
	OWN_REPLIES_SHOWN,
	REPLY_OPTIONS,
} from "#/config/ai";
import { AI_MESSAGES } from "#/config/prompts";
import { mapLimit } from "#/helpers/async";
import { words } from "#/helpers/text";
import { formatTime } from "#/helpers/time";

const CONCURRENCY = 6;
const BOT_NAME = /^(bot|guttasjefen)$/i;

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		runs: { type: "string", short: "n", default: "20" },
		config: { type: "string", short: "c", default: CONFIG_DIR },
		count: { type: "string", multiple: true, default: [] },
		profiles: { type: "boolean", default: false },
		"show-prompt": { type: "boolean", default: false },
		quiet: { type: "boolean", short: "q", default: false },
		temperature: { type: "string", short: "t" },
		jitter: { type: "string", short: "j", default: String(DIAL_JITTER) },
		"best-of": { type: "string", short: "b", default: String(BEST_OF) },
		verbose: { type: "boolean", short: "v", default: false },
		separate: { type: "boolean", default: false },
		dial: { type: "string", short: "d", multiple: true, default: [] },
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
			"Usage: pnpm test:prompt <scenario file | message> [-n 20] [-t temperature] [-b best-of] [-d dial=value ...] [-j jitter] [--separate] [-v] [--count regex] [--config dir] [--profiles] [--show-prompt] [-q]",
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

async function tasteFor(dials: string[]) {
	const taste = await loadTaste(values.config);
	if (!taste) {
		if (dials.length)
			throw new Error("No taste.json yet, run pnpm distill:taste first");
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
	const all = values.profiles ? await loadProfiles() : {};
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
const shownOwn = new Set(own.slice(-OWN_REPLIES_SHOWN));
const formatted = lines.map((l) => ({
	l,
	line: `[${l.time}] ${l.bot ? "Guttasjefen (deg)" : l.name}: ${l.bot && !shownOwn.has(l) ? AI_MESSAGES.OWN_REPLY_PLACEHOLDER : l.text}`,
}));
const transcript = formatted.map(({ line }) => line).join("\n");
const recent = [...shownOwn].map((l) => l.text);
const others = formatted
	.filter(({ l }) => !l.bot)
	.map(({ line }) => line)
	.join("\n");
const name = last.name.replace(/\s*\(.*\)$/, "");
const profiles = await profilesFor(lines);
const taste = await tasteFor(values.dial);

const bestOf = Number(values["best-of"]);
const together = !values.separate && bestOf > 1;

if (values["show-prompt"]) {
	const system = await buildSystem(profiles, taste, values.config);
	const prompt = buildUserPrompt(
		transcript,
		name,
		last.text,
		together ? bestOf : 1,
		taste,
	);
	console.log(`=== SYSTEM ===\n${system}\n\n=== USER ===\n${prompt}\n`);
}

const temperature = values.temperature
	? Number(values.temperature)
	: REPLY_OPTIONS.temperature;
if (taste)
	console.log(
		`Taste: ${Object.entries(taste.dials)
			.map(([name, { value }]) => `${name}=${value}`)
			.join(
				" ",
			)}${Number(values.jitter) > 0 ? ` (each ±${values.jitter} per run, except ±${DIAL_LIMIT})` : ""}`,
	);
console.log(
	`Running ${runs}× against "${last.text}" with ${values.config}/ at temperature ${temperature}, best of ${bestOf}${together ? " (one call)" : ""}\n`,
);

let printed = 0;

const results = await mapLimit(
	Array.from({ length: runs }),
	CONCURRENCY,
	async () => {
		const wobbled = jitterTaste(taste, Number(values.jitter));
		const system = await buildSystem(profiles, wobbled, values.config);
		const prompt = buildUserPrompt(
			transcript,
			name,
			last.text,
			together ? bestOf : 1,
			wobbled,
		);
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
const counts = new Map<string, number>();
for (const r of ok) {
	for (const w of words(r.reply)) {
		if (w.length < 4 || COMMON_WORDS.has(w)) continue;
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
		"\nFavourites to add to examples.txt (e.g. 3,7,12, empty to skip): ",
	);
	const bad = await rl.question(
		"Bad ones to add to disliked.txt (empty to skip): ",
	);
	rl.close();
	await saveRated(good, "examples.txt");
	await saveRated(bad, "disliked.txt");
}

async function saveRated(answer: string, file: string) {
	const numbers = new Set(
		answer
			.split(/[\s,]+/)
			.filter(Boolean)
			.map(Number),
	);
	const path = join(values.config, file);
	const existing = await readFile(path, "utf8").catch(() => "");
	const added = ok
		.filter((r) => numbers.has(r.number) && r.reply)
		.map((r) => `${last.text} → ${r.reply}`)
		.filter((line) => !existing.includes(line));
	if (added.length === 0) return;

	const separator = existing && !existing.endsWith("\n") ? "\n" : "";
	await appendFile(path, `${separator}${added.join("\n")}\n`);
	console.log(`Added ${added.length} to ${path}`);
}

if (process.stdin.isTTY && !values.quiet && ok.length) await rateReplies();
