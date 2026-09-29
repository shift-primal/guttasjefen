import {
	type Message,
	cleanContent as resolveMentions,
	type TextBasedChannel,
} from "discord.js";
import { AI_MESSAGES } from "#/config/prompts";
import { formatTime } from "#/helpers/time";

export function authorName(msg: Message, botId: string): string {
	if (msg.author.id === botId) return "Guttasjefen (deg)";
	return msg.member?.displayName ?? msg.author.displayName;
}

export function cleanMessageContent(msg: Message, botId: string): string {
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
		? AI_MESSAGES.OWN_REPLY_PLACEHOLDER
		: describeMessageContent(msg, botId, options?.imageCount ?? 0);
	return `[${time}] ${authorName(msg, botId)}${replyTo}: ${content}`;
}

export function channelName(channel: TextBasedChannel | null): string {
	return channel && "name" in channel ? `#${channel.name}` : "unknown channel";
}

export function preview(text: string, max = 120): string {
	const flat = text.replaceAll("\n", " ").trim();
	return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
