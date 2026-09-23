import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "discord.js";
import { PERSONA } from "#/ai/persona";
import { env } from "#/env";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const HISTORY_LIMIT = 20;
const DISCORD_MAX = 2000;

function toParam(msg: Message, botId: string): Anthropic.MessageParam {
	const text = msg.content.replaceAll(`<@${botId}>`, "").trim();
	if (msg.author.id === botId) return { role: "assistant", content: text };
	const name = msg.member?.displayName ?? msg.author.username;
	return { role: "user", content: `${name}: ${text}` };
}

export async function replyWithAI(message: Message<true>) {
	const botId = message.client.user.id;
	await message.channel.sendTyping();

	const recent = await message.channel.messages.fetch({
		limit: HISTORY_LIMIT,
		before: message.id,
	});
	const history = [...recent.values()]
		.reverse()
		.filter((m) => m.content)
		.map((m) => toParam(m, botId));
	while (history[0]?.role === "assistant") history.shift();

	const response = await anthropic.messages.create({
		model: "claude-sonnet-5",
		max_tokens: 16000,
		output_config: { effort: "low" },
		system: PERSONA,
		messages: [...history, toParam(message, botId)],
	});

	if (response.stop_reason === "refusal") {
		await message.reply("Nah, can't help with that one.");
		return;
	}

	const text = response.content
		.flatMap((b) => (b.type === "text" ? [b.text] : []))
		.join("");

	for (let i = 0; i < text.length; i += DISCORD_MAX) {
		await message.reply({
			content: text.slice(i, i + DISCORD_MAX),
			allowedMentions: { parse: [] },
		});
	}
}
