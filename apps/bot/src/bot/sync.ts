import {
	type BotJob,
	CHANNELS,
	claimJob,
	failInterruptedJobs,
	finishJob,
	listen,
} from "@guttasjefen/db";
import type { BotJobKind } from "@guttasjefen/db/settings";
import { isCachedSetting, refreshSettings } from "#/config/settings";
import { db } from "#/db";
import { reloadYoutubeCookies } from "#/music/setup";
import { distill, tagUntagged } from "#/personality/distill";

const TAG_DELAY_MS = 5000;

const JOBS: Record<BotJobKind, () => Promise<unknown>> = {
	distill: () => distill({ fresh: true }),
};

// Tagging and jobs both write example tags, so they run one at a time
let queue: Promise<unknown> = Promise.resolve();
function enqueue(label: string, work: () => Promise<unknown>) {
	queue = queue.then(work).catch((error) => {
		console.error(`[${label}] failed:`, error);
	});
}

let tagTimer: NodeJS.Timeout | undefined;
function scheduleTagging() {
	clearTimeout(tagTimer);
	tagTimer = setTimeout(
		() =>
			enqueue("tagging", async () => {
				const tagged = await tagUntagged();
				if (tagged) console.log(`[tagging] Tagged ${tagged} examples`);
			}),
		TAG_DELAY_MS,
	);
}

async function runJob(job: BotJob) {
	console.log(`[job ${job.id}] ${job.kind}`);
	try {
		const run = JOBS[job.kind];
		if (!run) throw new Error(`Unknown job kind "${job.kind}"`);
		await run();
		await finishJob(db, job.id);
		console.log(`[job ${job.id}] done`);
	} catch (error) {
		console.error(`[job ${job.id}] failed:`, error);
		await finishJob(db, job.id, error instanceof Error ? error.message : error);
	}
}

function runJobs() {
	enqueue("jobs", async () => {
		for (let job = await claimJob(db); job; job = await claimJob(db)) {
			await runJob(job);
		}
	});
}

async function settingChanged(key: string | null) {
	if (key === null) {
		await refreshSettings();
		await reloadYoutubeCookies();
		scheduleTagging();
		return;
	}
	if (isCachedSetting(key)) await refreshSettings([key]);
	if (key === "youtube-cookies") await reloadYoutubeCookies();
	if (key === "taste") scheduleTagging();
}

export async function startSync() {
	await failInterruptedJobs(db);
	listen(db, {
		[CHANNELS.setting]: (key) => {
			settingChanged(key).catch((error) =>
				console.error(`[sync] Reloading "${key ?? "all"}" failed:`, error),
			);
		},
		[CHANNELS.example]: scheduleTagging,
		[CHANNELS.botJob]: runJobs,
	});
}
