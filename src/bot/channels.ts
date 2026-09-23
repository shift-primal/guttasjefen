import { AI_CHANNEL_KEYWORDS, MUSIC_CHANNEL_KEYWORDS } from "#/constants";

function matches(name: string, keywords: string[]) {
	const lower = name.toLowerCase();
	return keywords.every((keyword) => lower.includes(keyword));
}

export function isMusicChannel(name: string) {
	return matches(name, MUSIC_CHANNEL_KEYWORDS);
}

export function isAIChannel(name: string) {
	return matches(name, AI_CHANNEL_KEYWORDS);
}

export function describeChannels(keywords: string[]) {
	return `channels with ${keywords.map((k) => `"${k}"`).join(" and ")} in the name`;
}
