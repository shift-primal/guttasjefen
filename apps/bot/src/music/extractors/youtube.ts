import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { YoutubeOptions } from "discord-player-youtubei";
import { COOKIE_DOMAIN } from "#/config/music";

// yt-dlp rewrites its cookie file on exit, so it gets a copy of the stored cookies
const COOKIE_COPY = join(tmpdir(), "yt-cookies.txt");

function cookieHeader(cookies: string) {
	const pairs: string[] = [];
	for (const raw of cookies.split("\n")) {
		const line = raw.replace(/^#HttpOnly_/, "").trim();
		if (!line || line.startsWith("#")) continue;
		const [domain, , , , , name, value] = line.split("\t");
		if (domain && name && COOKIE_DOMAIN.test(domain.replace(/^\./, ""))) {
			pairs.push(`${name}=${value ?? ""}`);
		}
	}
	return pairs.join("; ");
}

export function youtubeOptions(cookies: string): YoutubeOptions {
	const hasCookies = Boolean(cookies.trim());
	if (hasCookies) {
		writeFileSync(COOKIE_COPY, cookies);
	} else {
		console.warn("No YouTube cookies set, playing YouTube without cookies");
	}

	return {
		cookie: hasCookies ? cookieHeader(cookies) : undefined,
		downloads: {
			trialOrder: ["yt-dlp", "adaptive", "sabr"],
			ytdlp: { cookiePath: hasCookies ? COOKIE_COPY : undefined },
		},
	};
}
