import type { FilePart, TextPart } from "ai";
import type { Message } from "discord.js";
import { channelMatches, describeChannels } from "#/bot/channels";
import { CMD_PREFIX } from "#/config/bot";
import { preview } from "#/helpers/discord";
import { elapsed } from "#/helpers/time";
import {
	AI_CHANNEL_KEYWORDS,
	BEST_OF,
	HISTORY_LIMIT,
	OWN_REPLIES_SHOWN,
	RANDOM_REPLY_CHANCE,
	RANDOM_REPLY_CHANNEL_KEYWORDS,
} from "#/personality/config";
import {
	clearProfile,
	describeProfiles,
	loadProfiles,
	maybeUpdateProfiles,
	type Person,
} from "#/personality/profiles";
import { buildSystem, buildUserPrompt } from "#/personality/prompt";
import { AI_MESSAGES } from "#/personality/prompts";
import { generateCandidatesTogether, pickBest } from "#/personality/reply";
import { jitterTaste, loadActiveTaste, strongDials } from "#/personality/taste";
import {
	authorName,
	describeMessageContent,
	formatTranscriptLine,
	imageParts,
	imageUrls,
} from "#/personality/transcript";
import type { Command } from "#/types";

export const CHAT_HELP = `**Chat with me:** tag me or reply to one of my messages in any channel. In ${describeChannels(AI_CHANNEL_KEYWORDS)} I reply to every message, no tag needed, and in ${describeChannels(RANDOM_REPLY_CHANNEL_KEYWORDS)} I butt in every now and then.`;

// Replies when tagged, in AI channels, and now and then in random-reply channels
export async function maybeReply(message: Message<true>) {
	const mentioned = message.mentions.has(message.client.user, {
		ignoreEveryone: true,
		ignoreRoles: true,
	});
	const { name } = message.channel;
	const randomReply =
		channelMatches(name, RANDOM_REPLY_CHANNEL_KEYWORDS) &&
		Math.random() < RANDOM_REPLY_CHANCE;
	if (mentioned || channelMatches(name, AI_CHANNEL_KEYWORDS) || randomReply) {
		await replyWithAI(message).catch(console.error);
	}
}

async function replyWithAI(message: Message<true>) {
	const botId = message.client.user.id;
	const start = performance.now();
	const author = authorName(message, botId);
	const messageImageCount = imageUrls(message).length;
	const contentDescription = describeMessageContent(
		message,
		botId,
		messageImageCount,
	);

	console.log(
		`[ai] ${author} in #${message.channel.name}: ${preview(contentDescription)}`,
	);
	await message.channel.sendTyping();

	const recent = await message.channel.messages.fetch({
		limit: HISTORY_LIMIT,
		before: message.id,
	});
	const all = [...recent.values()];
	const reset = all.findIndex(
		(m) =>
			m.author.id === botId &&
			m.content.startsWith(AI_MESSAGES.CHAT_RESET_MARKER),
	);
	const log = (reset === -1 ? all : all.slice(0, reset))
		.reverse()
		.map((m) => ({ m, imageCount: imageUrls(m).length }))
		.filter(({ m, imageCount }) => m.content || imageCount > 0);

	// Only the bot's chat replies count as its own; music and command output doesn't
	const commandIds = new Set(
		log
			.filter(({ m }) => m.content.startsWith(CMD_PREFIX))
			.map(({ m }) => m.id),
	);
	const own = log
		.map(({ m }) => m)
		.filter(
			(m) =>
				m.author.id === botId &&
				m.reference?.messageId &&
				!m.interactionMetadata &&
				!commandIds.has(m.reference.messageId),
		);
	const shownOwn = new Set([
		...own.slice(-OWN_REPLIES_SHOWN),
		...own.filter((m) => m.id === message.reference?.messageId),
	]);

	const lines = [...log, { m: message, imageCount: messageImageCount }].map(
		({ m, imageCount }) => ({
			m,
			line: formatTranscriptLine(m, botId, {
				hidden: m.author.id === botId && !shownOwn.has(m),
				imageCount,
			}),
		}),
	);
	const transcript = lines.map(({ line }) => line).join("\n");
	const fromPeople = lines.filter(({ m }) => m.author.id !== botId);
	const peopleTranscript = fromPeople.map(({ line }) => line).join("\n");

	const people = new Map<string, Person>();
	for (const { m } of fromPeople) {
		if (!m.author.bot) {
			people.set(m.author.id, {
				name: authorName(m, botId),
				username: m.author.username,
			});
		}
	}

	const profiles = describeProfiles(await loadProfiles(), people);
	const taste = jitterTaste(await loadActiveTaste());
	const system = await buildSystem(profiles, taste);
	const prompt = buildUserPrompt(
		transcript,
		author,
		contentDescription,
		BEST_OF,
		taste,
	);
	const images = await imageParts(
		message,
		author,
		log.map(({ m }) => m),
	);

	const generate = (content: (TextPart | FilePart)[]) =>
		generateCandidatesTogether(system, content);

	const textPart: TextPart = { type: "text", text: prompt };
	const generateStart = performance.now();
	const candidates = images.length
		? await generate([textPart, ...images]).catch((error) => {
				console.error("Reply with images failed, retrying without:", error);
				return generate([textPart]);
			})
		: await generate([textPart]);
	const imageCount = images.filter((p) => p.type === "file").length;

	const usable = [
		...new Set(
			candidates
				.filter((c) => c.finishReason !== "content-filter" && c.reply)
				.map((c) => c.reply),
		),
	];
	if (
		usable.length === 0 &&
		candidates.some((c) => c.finishReason === "content-filter")
	) {
		await message.reply(AI_MESSAGES.CONTENT_FILTER_REPLY);
		return;
	}

	const picked = await pickBest(usable, {
		transcript,
		name: author,
		content: contentDescription,
		recent: [...shownOwn].map((m) => m.content),
		past: own.map((m) => m.content),
		others: peopleTranscript,
		people: profiles,
		strongDials: strongDials(taste),
	});
	const generateTime = elapsed(generateStart);
	const reply = usable[picked] || AI_MESSAGES.FALLBACK_REPLY;

	await message.reply({
		content: reply.slice(0, 2000),
		allowedMentions: { parse: [] },
	});
	console.log(
		`[ai] replied in ${elapsed(start)} (xai ${generateTime}, picked ${picked + 1}/${usable.length}${imageCount ? `, ${imageCount} images` : ""}): ${preview(reply)}`,
	);

	void maybeUpdateProfiles(message.channelId, peopleTranscript, people);
}

export const reset: Command = {
	name: "reset",
	description:
		"Make the AI forget this channel's chat history and its notes on you",
	slashOnly: true,
	async run(ctx) {
		const cleared = await clearProfile(ctx.member.id);
		await ctx.reply(
			cleared
				? `${AI_MESSAGES.CHAT_RESET_MARKER} Notes on ${ctx.member.displayName} wiped too.`
				: AI_MESSAGES.CHAT_RESET_MARKER,
		);
	},
};
