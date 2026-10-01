import type { FilePart, TextPart } from "ai";
import { type Message, cleanContent as resolveMentions } from "discord.js";
import { prompts, tunables } from "#/config/settings";
import { fill } from "#/helpers/text";
import { formatTime } from "#/helpers/time";
import { DIRECT_IMAGE_TYPES, MAX_IMAGE_BYTES } from "#/personality/config";

export function authorName(msg: Message, botId: string): string {
	if (msg.author.id === botId) return "Guttasjefen (deg)";
	return msg.member?.displayName ?? msg.author.displayName;
}

function cleanMessageContent(msg: Message, botId: string): string {
	return resolveMentions(msg.content.replaceAll(`<@${botId}>`, ""), msg.channel)
		.replaceAll("\n", " ")
		.trim();
}

export function describeMessageContent(
	msg: Message,
	botId: string,
	imageCount = 0,
): string {
	const marker =
		imageCount === 0
			? ""
			: imageCount === 1
				? "[bilde]"
				: `[${imageCount} bilder]`;
	return [cleanMessageContent(msg, botId), marker].filter(Boolean).join(" ");
}

export function formatTranscriptLine(
	msg: Message,
	botId: string,
	options?: { hidden?: boolean; imageCount?: number },
): string {
	const time = formatTime(msg.createdAt);
	const target = msg.mentions.repliedUser;
	const targetName =
		target &&
		(target.id === botId
			? "deg"
			: (msg.guild?.members.cache.get(target.id)?.displayName ??
				target.displayName));
	const replyTo = targetName ? ` (svarer ${targetName})` : "";
	const content = options?.hidden
		? prompts().ownReplyPlaceholder
		: describeMessageContent(msg, botId, options?.imageCount ?? 0);
	return `[${time}] ${authorName(msg, botId)}${replyTo}: ${content}`;
}

function asPng(proxyURL: string) {
	const url = new URL(proxyURL);
	url.searchParams.set("format", "png");
	return url;
}

export function imageUrls(msg: Message): URL[] {
	const urls: URL[] = [];

	for (const attachment of msg.attachments.values()) {
		const type = attachment.contentType?.split(";")[0];
		if (!type?.startsWith("image/") || attachment.size > MAX_IMAGE_BYTES)
			continue;
		urls.push(
			DIRECT_IMAGE_TYPES.has(type)
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

export function imageParts(
	message: Message<true>,
	name: string,
	replied: Message | null,
	log: Message[],
) {
	const botId = message.client.user.id;
	const groups: [string, URL[]][] = [
		[fill(prompts().imageDirect, { name }), imageUrls(message)],
	];

	if (replied) {
		const author = authorName(replied, botId);
		groups.push([
			fill(prompts().imageReplied, { name, author }),
			imageUrls(replied),
		]);
	}

	// "gjett hva dette er" [bilde], then "svar da" without it: they still mean that picture
	if (groups.every(([, urls]) => urls.length === 0)) {
		const earlier = [...log].reverse().find((m) => imageUrls(m).length > 0);
		if (earlier) {
			groups.push([
				fill(prompts().imageEarlier, {
					author: authorName(earlier, botId),
					time: formatTime(earlier.createdAt),
				}),
				imageUrls(earlier),
			]);
		}
	}

	const parts: (TextPart | FilePart)[] = [];
	let remaining = tunables().chat.maxImages;
	for (const [label, urls] of groups) {
		const taken = urls.slice(0, remaining);
		if (taken.length === 0) continue;
		remaining -= taken.length;
		parts.push(
			{ type: "text", text: label },
			...taken.map(
				(data): FilePart => ({ type: "file", data, mediaType: "image" }),
			),
		);
	}
	return parts;
}
