import { setTimeout as sleep } from "node:timers/promises";
import { clearProfile, loadActiveTaste, loadProfiles } from "@guttasjefen/db";
import type { FilePart, TextPart } from "ai";
import type { Message } from "discord.js";
import { channelMatches, describeChannels } from "#/bot/channels";
import { prompts, tunables } from "#/config/settings";
import { db } from "#/db";
import { preview } from "#/helpers/discord";
import { elapsed } from "#/helpers/time";
import { TYPING_REFRESH_MS } from "#/personality/config";
import { describeLore, updateLore } from "#/personality/lore";
import {
	describeProfiles,
	maybeUpdateProfiles,
	type Person,
} from "#/personality/profiles";
import { buildSystem, buildUserPrompt } from "#/personality/prompt";
import { generateCandidatesTogether, pickBest } from "#/personality/reply";
import { jitterTaste, strongDials } from "#/personality/taste";
import {
	authorName,
	describeMessageContent,
	formatTranscriptLine,
	imageParts,
	imageUrls,
} from "#/personality/transcript";
import type { Command } from "#/types";

export const chatHelp = () =>
	`**Chat with me:** tag me or reply to one of my messages in any channel. In ${describeChannels(tunables().chat.aiChannelKeywords)} I reply to every message, no tag needed, and in ${describeChannels(tunables().chat.randomReplyChannelKeywords)} I butt in every now and then.`;

type Channel = Message<true>["channel"];

// Shows "is typing…" for as long as any reply in the channel is pending
const typing = new Map<
	string,
	{ pending: number; send: () => void; timer: NodeJS.Timeout }
>();

function keepTyping(channel: Channel) {
	const current = typing.get(channel.id);
	if (current) {
		current.pending++;
	} else {
		const send = () => {
			channel.sendTyping().catch(() => {});
		};
		send();
		typing.set(channel.id, {
			pending: 1,
			send,
			timer: setInterval(send, TYPING_REFRESH_MS),
		});
	}
	return () => {
		const entry = typing.get(channel.id);
		if (!entry) return;
		// Sending a reply clears the indicator, so put it back for the next one
		if (--entry.pending > 0) return entry.send();
		clearInterval(entry.timer);
		typing.delete(channel.id);
	};
}

// Each reply waits for the one before it in the channel so it can see it,
// but only up to the turn wait limit, so a burst of messages doesn't pile up
const queues = new Map<string, Promise<void>>();

function inTurn(channel: Channel, task: () => Promise<void>) {
	const stopTyping = keepTyping(channel);
	const previous = queues.get(channel.id);
	const turn = previous
		? Promise.race([previous, sleep(tunables().chat.turnWaitLimitMs)])
		: Promise.resolve();
	const next: Promise<void> = turn
		.then(task)
		.catch(console.error)
		.finally(() => {
			stopTyping();
			if (queues.get(channel.id) === next) queues.delete(channel.id);
		});
	queues.set(channel.id, next);
	return next;
}

// Replies when tagged, in AI channels, and now and then in random-reply channels
export async function maybeReply(message: Message<true>) {
	const mentioned = message.mentions.has(message.client.user, {
		ignoreEveryone: true,
		ignoreRoles: true,
	});
	const { name } = message.channel;
	const randomReply =
		channelMatches(name, tunables().chat.randomReplyChannelKeywords) &&
		Math.random() < tunables().chat.randomReplyChance;
	if (
		mentioned ||
		channelMatches(name, tunables().chat.aiChannelKeywords) ||
		randomReply
	) {
		const queuedAt = performance.now();
		await inTurn(message.channel, () => replyWithAI(message, queuedAt));
	}
}

async function replyWithAI(message: Message<true>, queuedAt: number) {
	const botId = message.client.user.id;
	const waited = performance.now() - queuedAt;
	const start = performance.now();
	const author = authorName(message, botId);
	const messageImageCount = imageUrls(message).length;
	const contentDescription = describeMessageContent(
		message,
		botId,
		messageImageCount,
	);

	console.log(
		`[ai] ${author} in #${message.channel.name}${waited > 500 ? ` (waited ${(waited / 1000).toFixed(1)}s for its turn)` : ""}: ${preview(contentDescription)}`,
	);

	const [before, after] = await Promise.all([
		message.channel.messages.fetch({
			limit: tunables().chat.historyLimit,
			before: message.id,
		}),
		// Anything sent while this reply waited its turn, like its replies to others
		message.channel.messages.fetch({
			limit: tunables().chat.laterLimit,
			after: message.id,
		}),
	]);
	const newestFirst = [...before.values()];
	const reset = newestFirst.findIndex(
		(m) =>
			m.author.id === botId && m.content.startsWith(prompts().chatResetMarker),
	);
	const earlier = (reset === -1 ? newestFirst : newestFirst.slice(0, reset))
		.reverse()
		.map((m) => ({ m, imageCount: imageUrls(m).length }));
	const later = [...after.values()]
		.sort((a, b) => a.createdTimestamp - b.createdTimestamp)
		.map((m) => ({ m, imageCount: imageUrls(m).length }));
	const all = [
		...earlier,
		{ m: message, imageCount: messageImageCount },
		...later,
	].filter(({ m, imageCount }) => m === message || m.content || imageCount > 0);

	// Only the bot's chat replies count as its own; music and command output doesn't
	const commandIds = new Set(
		all
			.filter(({ m }) => m.content.startsWith(tunables().commands.prefix))
			.map(({ m }) => m.id),
	);
	const own = all
		.map(({ m }) => m)
		.filter(
			(m) =>
				m.author.id === botId &&
				m.reference?.messageId &&
				!m.interactionMetadata &&
				!commandIds.has(m.reference.messageId),
		);
	const ownIds = new Set(own.map((m) => m.id));
	const resetAt =
		reset === -1 ? 0 : (newestFirst[reset]?.createdTimestamp ?? 0);
	const chain = (await replyChain(message)).filter(
		(m) => m.createdTimestamp > resetAt,
	);
	const chainIds = new Set(chain.map((m) => m.id));
	const replied =
		chain.at(-1)?.id === message.reference?.messageId
			? chain.at(-1)
			: undefined;
	// What the judge checks for repeats: its latest replies, and the one they answer
	const recentOwn = new Set([
		...own.slice(-tunables().chat.ownRepliesShown),
		...own.filter((m) => m.id === replied?.id),
	]);
	// Everything it said in the conversation it's in stays readable, older replies are hidden
	const byId = new Map(all.map(({ m }) => [m.id, m]));
	const toThem = (m: Message) =>
		m.reference?.messageId &&
		byId.get(m.reference.messageId)?.author.id === message.author.id;
	// Everything it said in the conversation it's in stays readable, the rest of its older replies are hidden
	const shownOwn = new Set([
		...recentOwn,
		...own.filter((m) => chainIds.has(m.id) || toThem(m)),
	]);
	// Its music and command output isn't part of the conversation
	const log = all.filter(({ m }) => m.author.id !== botId || ownIds.has(m.id));

	const lines = log.map(({ m, imageCount }) => ({
		m,
		line: formatTranscriptLine(m, botId, {
			hidden: m.author.id === botId && !shownOwn.has(m),
			imageCount,
		}),
	}));
	const answering = message !== log.at(-1)?.m;
	const transcript = lines
		.map(({ m, line }) =>
			answering && m === message
				? `${line} ${prompts().answeringMarker}`
				: line,
		)
		.join("\n");
	const fromPeople = lines.filter(({ m }) => m.author.id !== botId);
	const peopleTranscript = fromPeople.map(({ line }) => line).join("\n");

	// The start of the conversation, when it's older than the log
	const logIds = new Set(log.map(({ m }) => m.id));
	const thread = chain
		.filter((m) => !logIds.has(m.id))
		.map((m) =>
			formatTranscriptLine(m, botId, { imageCount: imageUrls(m).length }),
		)
		.join("\n");

	const people = new Map<string, Person>();
	for (const { m } of fromPeople) {
		if (!m.author.bot) {
			people.set(m.author.id, {
				name: authorName(m, botId),
				username: m.author.username,
			});
		}
	}

	const profiles = describeProfiles(await loadProfiles(db), people);
	const taste = jitterTaste(await loadActiveTaste(db));
	const lore = await describeLore(`${thread}\n${transcript}`);
	const acceptClaims = Math.random() < tunables().chat.claimAcceptChance;
	const system = await buildSystem({ profiles, taste, lore });
	const prompt = buildUserPrompt({
		transcript,
		name: author,
		content: contentDescription,
		count: tunables().reply.bestOf,
		taste,
		thread,
		acceptClaims,
	});
	const images = imageParts(
		message,
		author,
		replied ?? null,
		log
			.filter(({ m }) => m.createdTimestamp < message.createdTimestamp)
			.map(({ m }) => m),
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
		await message.reply(prompts().contentFilterReply);
		return;
	}

	const picked = await pickBest(usable, {
		transcript,
		name: author,
		content: contentDescription,
		recent: [...recentOwn].map((m) => m.content),
		past: own.map((m) => m.content),
		others: peopleTranscript,
		people: profiles,
		strongDials: strongDials(taste),
		lore,
		acceptClaims,
	});
	const generateTime = elapsed(generateStart);
	const reply = usable[picked] || prompts().fallbackReply;

	await message.reply({
		content: reply.slice(0, 2000),
		allowedMentions: { parse: [] },
	});
	console.log(
		`[ai] replied in ${elapsed(start)} (xai ${generateTime}, picked ${picked + 1}/${usable.length}${imageCount ? `, ${imageCount} images` : ""}): ${preview(reply)}`,
	);

	void maybeUpdateProfiles(message.channelId, peopleTranscript, people);
	if (usable[picked]) {
		const context = [
			thread,
			...lines.slice(-tunables().lore.contextLines).map(({ line }) => line),
		];
		void updateLore(context.filter(Boolean).join("\n"), reply);
	}
}

// The messages their message replies to, and what those reply to, oldest first
async function replyChain(message: Message<true>) {
	const chain: Message<true>[] = [];
	let current = message;
	while (
		chain.length < tunables().chat.threadLimit &&
		current.reference?.messageId
	) {
		const parent = await current.fetchReference().catch(() => null);
		if (!parent) break;
		chain.unshift(parent);
		current = parent;
	}
	return chain;
}

export const reset: Command = {
	name: "reset",
	description:
		"Make the AI forget this channel's chat history and its notes on you",
	slashOnly: true,
	async run(ctx) {
		const cleared = await clearProfile(db, ctx.member.id);
		await ctx.reply(
			cleared
				? `${prompts().chatResetMarker} Notes on ${ctx.member.displayName} wiped too.`
				: prompts().chatResetMarker,
		);
	},
};
