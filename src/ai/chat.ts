import { type FilePart, generateText, type TextPart } from "ai";
import type { Message } from "discord.js";
import { imageUrls } from "#/ai/images";
import { model, REPLY_OPTIONS } from "#/ai/model";
import {
	describeProfiles,
	loadProfiles,
	maybeUpdateProfiles,
} from "#/ai/profiles";
import {
	buildSystem,
	buildUserPrompt,
	cleanReply,
	OWN_REPLY_PLACEHOLDER,
} from "#/ai/prompt";
import { CHAT_RESET_MARKER } from "#/constants";
import { elapsed, preview } from "#/log";

const HISTORY_LIMIT = 15;
const FALLBACK_REPLY = "og?";
const MAX_IMAGES = 4;

function authorName(msg: Message, botId: string) {
	if (msg.author.id === botId) return "Guttasjefen (deg)";
	return msg.member?.displayName ?? msg.author.displayName;
}

function cleanContent(msg: Message, botId: string) {
	return msg.content.replaceAll(`<@${botId}>`, "").replaceAll("\n", " ").trim();
}

function describeContent(msg: Message, botId: string) {
	const count = imageUrls(msg).length;
	const marker =
		count === 0 ? "" : count === 1 ? "[bilde]" : `[${count} bilder]`;
	return [cleanContent(msg, botId), marker].filter(Boolean).join(" ");
}

function formatLine(msg: Message, botId: string) {
	const time = msg.createdAt.toLocaleTimeString("nb-NO", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Europe/Oslo",
	});
	const target = msg.mentions.repliedUser;
	const replyTo = target
		? ` (svarer ${target.id === botId ? "deg" : target.displayName})`
		: "";
	const content =
		msg.author.id === botId
			? OWN_REPLY_PLACEHOLDER
			: describeContent(msg, botId);
	return `[${time}] ${authorName(msg, botId)}${replyTo}: ${content}`;
}

export async function replyWithAI(message: Message<true>) {
	const botId = message.client.user.id;
	const start = performance.now();
	console.log(
		`[ai] ${authorName(message, botId)} in #${message.channel.name}: ${preview(describeContent(message, botId))}`,
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
		.filter((m) => m.content || imageUrls(m).length > 0);

	const transcript = [...log, message]
		.map((m) => formatLine(m, botId))
		.join("\n");

	const people = new Map<string, string>();
	for (const m of [...log, message]) {
		if (m.author.id !== botId && !m.author.bot)
			people.set(m.author.id, authorName(m, botId));
	}

	const name = authorName(message, botId);

	const profiles = describeProfiles(
		await loadProfiles(),
		new Set(people.keys()),
	);
	const system = await buildSystem(profiles);
	const prompt = buildUserPrompt(
		transcript,
		name,
		describeContent(message, botId),
		system.move,
	);
	const images = await imageParts(message, name);

	const generate = (content: (TextPart | FilePart)[]) =>
		generateText({
			model,
			...REPLY_OPTIONS,
			system: system.text,
			messages: [{ role: "user", content }],
		});

	const textPart: TextPart = { type: "text", text: prompt };
	const generateStart = performance.now();
	const { text, finishReason } = images.length
		? await generate([textPart, ...images]).catch((error) => {
				console.error("Reply with images failed, retrying without:", error);
				return generate([textPart]);
			})
		: await generate([textPart]);
	const generateTime = elapsed(generateStart);
	const imageCount = images.filter((p) => p.type === "file").length;

	if (finishReason === "content-filter") {
		await message.reply("Nah, can't help with that one.");
		return;
	}

	const reply = cleanReply(text) || FALLBACK_REPLY;

	await message.reply({
		content: reply.slice(0, 2000),
		allowedMentions: { parse: [] },
	});
	console.log(
		`[ai] replied in ${elapsed(start)} (xai ${generateTime}${imageCount ? `, ${imageCount} images` : ""}${system.moveName ? `, ${system.moveName}` : ""}): ${preview(reply)}`,
	);

	const peopleTranscript = [...log, message]
		.filter((m) => m.author.id !== botId)
		.map((m) => formatLine(m, botId))
		.join("\n");
	void maybeUpdateProfiles(model, message.channelId, peopleTranscript, people);
}

async function imageParts(message: Message<true>, name: string) {
	const groups: [string, URL[]][] = [
		[`Bilder fra meldingen til ${name}:`, imageUrls(message)],
	];

	if (message.reference?.messageId) {
		const replied = await message.fetchReference().catch(() => null);
		if (replied) {
			const author = authorName(replied, message.client.user.id);
			groups.push([
				`Bilder fra meldingen ${name} svarer på (sendt av ${author}):`,
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
