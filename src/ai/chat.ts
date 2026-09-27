import { readFile } from "node:fs/promises";
import { createXai } from "@ai-sdk/xai";
import { type FilePart, generateText, type TextPart } from "ai";
import type { Message } from "discord.js";
import { imageUrls } from "#/ai/images";
import {
	describeProfiles,
	loadProfiles,
	maybeUpdateProfiles,
} from "#/ai/profiles";
import { CHAT_RESET_MARKER } from "#/constants";
import { env } from "#/env";
import { elapsed, preview } from "#/log";

const xai = createXai({ apiKey: env.XAI_API_KEY });
const model = xai("grok-4.20-non-reasoning");

const PERSONA_PATH = "config/persona.md";
const CHAT_RULES_PATH = "config/chat-rules.md";
const HISTORY_LIMIT = 15;
// The bot's own replies are hidden from the log: the model copies the
// structure of whatever it said last, so every reply turns into a template.
const OWN_REPLY_PLACEHOLDER = "[ditt svar, skjult]";
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

	const [persona, rules] = await Promise.all([
		readFile(PERSONA_PATH, "utf8"),
		readFile(CHAT_RULES_PATH, "utf8"),
	]);
	const profiles = describeProfiles(
		await loadProfiles(),
		new Set(people.keys()),
	);

	const prompt = [
		`Chatlogg:\n${transcript}`,
		`Du svarer nå ${name}. Meldingen deres: ${describeContent(message, botId)}`,
		"Skriv kun svaret ditt, én linje, uten navn eller tidsstempel foran.",
	]
		.filter(Boolean)
		.join("\n\n");
	const images = await imageParts(message, name);

	const generate = (content: (TextPart | FilePart)[]) =>
		generateText({
			model,
			maxOutputTokens: 200,
			temperature: 1,
			system: `${persona.trim()}\n\n${rules.trim()}${profiles}`,
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

	const reply =
		text
			.trim()
			.split("\n")[0]
			?.replace(/^\[\d{2}:\d{2}\]\s*/, "")
			.replace(/^Guttasjefen( \(deg\))?:\s*/i, "")
			.trim() || FALLBACK_REPLY;

	await message.reply({
		content: reply.slice(0, 2000),
		allowedMentions: { parse: [] },
	});
	console.log(
		`[ai] replied in ${elapsed(start)} (xai ${generateTime}${imageCount ? `, ${imageCount} images` : ""}): ${preview(reply)}`,
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
