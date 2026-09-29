import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { YoutubeOptions } from "discord-player-youtubei";
import { CONFIG_DIR } from "#/config/ai";
import { COOKIE_DOMAIN } from "#/config/music";

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
	const path = join(CONFIG_DIR, "cookies.txt");
	const hasCookies = existsSync(path);
	if (!hasCookies) {
		console.warn(`No ${path}, playing YouTube without cookies`);
	}

	return {
		cookie: hasCookies ? cookieHeader(path) : undefined,
		downloads: {
			trialOrder: ["yt-dlp", "adaptive", "sabr"],
			ytdlp: { cookiePath: hasCookies ? writableCopy(path) : undefined },
		},
	};
}
