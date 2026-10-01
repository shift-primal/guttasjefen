import { tunables } from "#/config/settings";

export function channelMatches(name: string, keywords: string[]) {
	const lower = name.toLowerCase();
	return keywords.every((keyword) => lower.includes(keyword));
}

export function isMusicChannel(name: string) {
	return channelMatches(name, tunables().commands.musicChannelKeywords);
}

export function describeChannels(keywords: string[]) {
	return `channels with ${keywords.map((k) => `"${k}"`).join(" and ")} in the name`;
}
