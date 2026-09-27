import type { Message } from "discord.js";

const DIRECT_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_BYTES = 10 * 1024 * 1024;

function asPng(proxyURL: string) {
	const url = new URL(proxyURL);
	url.searchParams.set("format", "png");
	return url;
}

export function imageUrls(msg: Message): URL[] {
	const urls: URL[] = [];

	for (const attachment of msg.attachments.values()) {
		const type = attachment.contentType?.split(";")[0];
		if (!type?.startsWith("image/") || attachment.size > MAX_BYTES) continue;
		urls.push(
			DIRECT_TYPES.has(type)
				? new URL(attachment.url)
				: asPng(attachment.proxyURL),
		);
	}

	for (const embed of msg.embeds) {
		const media = embed.image ?? embed.thumbnail;
		if (media?.proxyURL) urls.push(asPng(media.proxyURL));
	}

	return urls;
}
