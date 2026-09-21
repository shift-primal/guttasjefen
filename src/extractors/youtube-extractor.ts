import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { YoutubeOptions } from "discord-player-youtubei";
import { env } from "#/env";

const COOKIE_DOMAIN = /(^|\.)(youtube|google)\.com$/;

function cookieHeader(path: string) {
	const pairs: string[] = [];
	for (const raw of readFileSync(path, "utf8").split("\n")) {
		const line = raw.replace(/^#HttpOnly_/, "").trim();
		if (!line || line.startsWith("#")) continue;
		const [domain, , , , , name, value] = line.split("\t");
		if (domain && name && COOKIE_DOMAIN.test(domain.replace(/^\./, ""))) {
			pairs.push(`${name}=${value ?? ""}`);
		}
	}
	return pairs.join("; ");
}

// yt-dlp rewrites its cookie file on exit, so hand it a copy and keep the original intact
function writableCopy(path: string) {
	const copy = join(tmpdir(), "yt-cookies.txt");
	copyFileSync(path, copy);
	return copy;
}

export function youtubeOptions(): YoutubeOptions {
	const path = env.YOUTUBE_COOKIES_PATH;
	const hasCookies = path && existsSync(path);
	if (path && !hasCookies) {
		console.warn(`YOUTUBE_COOKIES_PATH set but ${path} does not exist`);
	}

	return {
		cookie: hasCookies ? cookieHeader(path) : undefined,
		downloads: {
			trialOrder: ["yt-dlp", "adaptive", "sabr"],
			ytdlp: { cookiePath: hasCookies ? writableCopy(path) : undefined },
		},
	};
}
