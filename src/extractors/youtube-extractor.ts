import { existsSync, readFileSync } from "node:fs";
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
			ytdlp: { cookiePath: hasCookies ? path : undefined },
		},
	};
}
