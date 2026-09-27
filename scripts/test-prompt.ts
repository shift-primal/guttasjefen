import { existsSync } from "node:fs";
import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { REPLY_OPTIONS } from "#/ai/model";
import { describeProfiles, loadProfiles } from "#/ai/profiles";
import {
	buildSystem,
	buildUserPrompt,
	CONFIG_DIR,
	OWN_REPLY_PLACEHOLDER,
} from "#/ai/prompt";
import {
	BEST_OF,
	generateCandidates,
	generateCandidatesTogether,
	pickBest,
} from "#/ai/reply";

const CONCURRENCY = 6;
const BOT_NAME = /^(bot|guttasjefen)$/i;
const COMMON_WORDS = new Set(
	"ikke bare også eller skal være sånn fordi etter over under dette hvis blir litt helt aldri alltid noen hele mens siden uten ditt mitt dine mine deres hvor hvem hvorfor hvordan kanskje fortsatt allerede faktisk igjen enda både skulle kunne ville have hadde sier gjør gjøre".split(
		" ",
	),
);

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
		"best-of": { type: "string", short: "b", default: String(BEST_OF) },
		verbose: { type: "boolean", short: "v", default: false },
		separate: { type: "boolean", default: false },
	},
});

type Line = { time: string; name: string; text: string; bot: boolean };

function now() {
	return new Date().toLocaleTimeString("nb-NO", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Europe/Oslo",
	});
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
			"Usage: pnpm test-prompt <scenario file | message> [-n 20] [-t temperature] [-b best-of] [--separate] [-v] [--count regex] [--config dir] [--profiles] [--show-prompt] [-q]",
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

async function profilesFor(lines: Line[]) {
	if (!values.profiles) return "";
	const names = new Set(lines.map((l) => l.name.replace(/\s*\(.*\)$/, "")));
	const all = await loadProfiles();
	const ids = Object.entries(all)
		.filter(([, p]) => names.has(p.name))
		.map(([id]) => id);
	return describeProfiles(all, new Set(ids));
}

function isLoop(text: string) {
	const words = text.split(/\s+/);
	for (let size = 2; size * 2 <= words.length; size++) {
		for (let i = 0; i + size * 2 <= words.length; i++) {
			if (
				words.slice(i, i + size).join(" ") ===
				words.slice(i + size, i + size * 2).join(" ")
			)
				return true;
		}
	}
	return false;
}

function words(text: string) {
	return new Set(text.toLowerCase().match(/[\p{L}\d]+/gu) ?? []);
}

async function mapLimit<T, R>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<R>,
) {
	const results: R[] = [];
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const index = next++;
			results[index] = await fn(items[index] as T);
		}
	};
	await Promise.all(Array.from({ length: limit }, worker));
	return results;
}

const { lines, last } = await loadScenario(positionals[0]);
const runs = Number(values.runs);
const transcript = lines
	.map(
		(l) =>
			`[${l.time}] ${l.bot ? "Guttasjefen (deg)" : l.name}: ${l.bot ? OWN_REPLY_PLACEHOLDER : l.text}`,
	)
	.join("\n");
const name = last.name.replace(/\s*\(.*\)$/, "");
const profiles = await profilesFor(lines);

const bestOf = Number(values["best-of"]);
const together = !values.separate && bestOf > 1;

if (values["show-prompt"]) {
	const system = await buildSystem(profiles, "show-prompt", values.config);
	const prompt = buildUserPrompt(
		transcript,
		name,
		last.text,
		system.mood,
		together ? bestOf : 1,
	);
	console.log(`=== SYSTEM ===\n${system.text}\n\n=== USER ===\n${prompt}\n`);
}

const temperature = values.temperature
	? Number(values.temperature)
	: REPLY_OPTIONS.temperature;
console.log(
	`Running ${runs}× against "${last.text}" with ${values.config}/ at temperature ${temperature}, best of ${bestOf}${together ? " (one call)" : ""}\n`,
);

let printed = 0;

const results = await mapLimit(
	Array.from({ length: runs }, (_, i) => i),
	CONCURRENCY,
	async (run) => {
		const system = await buildSystem(profiles, `run-${run}`, values.config);
		const prompt = buildUserPrompt(
			transcript,
			name,
			last.text,
			system.mood,
			together ? bestOf : 1,
		);
		const started = performance.now();
		try {
			const content = [{ type: "text" as const, text: prompt }];
			const candidates = together
				? await generateCandidatesTogether(system.text, content, temperature)
				: await generateCandidates(system.text, content, bestOf, temperature);
			const picked = await pickBest(
				candidates.map((c) => c.reply),
				{ transcript, name, content: last.text },
			);
			const { reply, finishReason } = candidates[picked] ?? {
				reply: "",
				finishReason: "error",
			};
			const number = ++printed;
			if (!values.quiet) {
				console.log(
					`${String(number).padStart(4)}  ${`[${system.moodName ?? "-"}]`.padEnd(14)} ${reply}`,
				);
				if (values.verbose)
					for (const [i, c] of candidates.entries())
						if (i !== picked) console.log(`${" ".repeat(21)}✗ ${c.reply}`);
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

async function pickFavourites() {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const answer = await rl.question(
		"\nFavourites to add to examples.txt (e.g. 3,7,12, empty to skip): ",
	);
	rl.close();

	const numbers = new Set(
		answer
			.split(/[\s,]+/)
			.filter(Boolean)
			.map(Number),
	);
	const path = join(values.config, "examples.txt");
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

if (process.stdin.isTTY && !values.quiet && ok.length) await pickFavourites();
