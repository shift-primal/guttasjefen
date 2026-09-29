import type { FilePart, TextPart } from "ai";
import type { Message } from "discord.js";
import { imageUrls } from "#/ai/images";
import { model } from "#/ai/model";
import {
	describeProfiles,
	loadProfiles,
	maybeUpdateProfiles,
	type Person,
} from "#/ai/profiles";
import { buildSystem, buildUserPrompt } from "#/ai/prompt";
import { generateCandidatesTogether, pickBest } from "#/ai/reply";
import {
	BEST_OF,
	HISTORY_LIMIT,
	MAX_IMAGES,
	OWN_REPLIES_SHOWN,
} from "#/config/ai";
import { CHAT_RESET_MARKER, CMD_PREFIX } from "#/config/bot";
import { AI_MESSAGES, IMAGE_PROMPT_LABELS } from "#/config/prompts";
import {
	authorName,
	describeMessageContent,
	formatTranscriptLine,
	preview,
} from "#/helpers/discord";
import { elapsed } from "#/helpers/time";

export async function replyWithAI(message: Message<true>) {
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
		(m) => m.author.id === botId && m.content.startsWith(CHAT_RESET_MARKER),
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
	const system = await buildSystem(profiles);
	const prompt = buildUserPrompt(
		transcript,
		author,
		contentDescription,
		BEST_OF,
	);
	const images = await imageParts(message, author);

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

	void maybeUpdateProfiles(model, message.channelId, peopleTranscript, people);
}

async function imageParts(message: Message<true>, name: string) {
	const groups: [string, URL[]][] = [
		[IMAGE_PROMPT_LABELS.direct(name), imageUrls(message)],
	];

	if (message.reference?.messageId) {
		const replied = await message.fetchReference().catch(() => null);
		if (replied) {
			const author = authorName(replied, message.client.user.id);
			groups.push([
				IMAGE_PROMPT_LABELS.replied(name, author),
				imageUrls(replied),
			]);
		}
	}

	const parts: (TextPart | FilePart)[] = [];
	let remaining = MAX_IMAGES;
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
