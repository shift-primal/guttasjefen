import { MUSIC_CHANNEL_KEYWORDS } from "#/config/bot";

export function channelMatches(name: string, keywords: string[]) {
	const lower = name.toLowerCase();
	return keywords.every((keyword) => lower.includes(keyword));
}

export function isMusicChannel(name: string) {
	return channelMatches(name, MUSIC_CHANNEL_KEYWORDS);
}

export function describeChannels(keywords: string[]) {
	return `channels with ${keywords.map((k) => `"${k}"`).join(" and ")} in the name`;
}
