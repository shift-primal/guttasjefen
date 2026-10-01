import { z } from "zod";
import { promptsSchema } from "./prompts";

export * from "./prompts";

export const DIAL_LIMIT = 2;
export const DIAL_STEP = 0.5;

export const dialSchema = z.object({
	value: z.number(),
	low: z.string(),
	high: z.string(),
});
export const tasteSchema = z.object({
	enabled: z.boolean().default(true),
	notes: z.string().default(""),
	dials: z.record(z.string(), dialSchema).default({}),
});
export const tagsSchema = z.record(
	z.string(),
	z.record(z.string(), z.number()),
);
export const dialOverridesSchema = z.object({
	enabled: z.boolean().optional(),
	dials: z.record(z.string(), z.number()).default({}),
});

export type Dial = z.infer<typeof dialSchema>;
export type Taste = z.infer<typeof tasteSchema>;
export type Tags = z.infer<typeof tagsSchema>;
export type DialOverrides = z.infer<typeof dialOverridesSchema>;

export function clampDial(value: number) {
	return Math.max(-DIAL_LIMIT, Math.min(DIAL_LIMIT, value));
}

export function withOverrides(
	taste: Taste,
	overrides: Record<string, number>,
): Taste {
	const dials = { ...taste.dials };
	for (const [name, value] of Object.entries(overrides)) {
		const dial = dials[name];
		if (!dial) {
			throw new Error(
				`Unknown dial "${name}". Dials: ${Object.keys(dials).join(", ")}`,
			);
		}
		dials[name] = { ...dial, value: clampDial(value) };
	}
	return { ...taste, dials };
}

export function pruneOverrides(
	taste: Taste,
	{ enabled, dials }: DialOverrides,
): DialOverrides {
	return {
		...(enabled !== undefined && enabled !== taste.enabled ? { enabled } : {}),
		dials: Object.fromEntries(
			Object.entries(dials).filter(
				([name, value]) =>
					taste.dials[name] && taste.dials[name].value !== value,
			),
		),
	};
}

export function tuneTaste(taste: Taste, { enabled, dials }: DialOverrides) {
	const known = Object.entries(dials).filter(([name]) => name in taste.dials);
	return {
		...withOverrides(taste, Object.fromEntries(known)),
		enabled: enabled ?? taste.enabled,
	};
}

const chance = z.number().min(0).max(1);
const count = z.int().min(0);
const tokens = z.int().min(1);
const wordList = (words: string) =>
	z.array(z.string()).default(words.split(" "));

export const tunablesSchema = z.object({
	chat: z
		.object({
			model: z
				.string()
				.min(1)
				.default("grok-4.20-non-reasoning")
				.describe(
					"xAI model used for every reply, judge, lore and profile call",
				),
			aiChannelKeywords: z
				.array(z.string())
				.default(["bot", "chat"])
				.describe(
					"Channels whose name contains one of these get a reply to every message",
				),
			randomReplyChannelKeywords: z
				.array(z.string())
				.default(["general"])
				.describe(
					"Channels whose name contains one of these get a reply now and then",
				),
			randomReplyChance: chance
				.default(0.25)
				.describe(
					"Chance of butting in on a message in a random-reply channel",
				),
			historyLimit: z
				.int()
				.min(1)
				.max(100)
				.default(25)
				.describe("Chat messages read before each reply"),
			laterLimit: z
				.int()
				.min(0)
				.max(100)
				.default(10)
				.describe(
					"Messages sent after the one it's answering, while it waited for its turn",
				),
			threadLimit: count
				.default(12)
				.describe(
					"How far back it follows a chain of replies, past the chat log",
				),
			turnWaitLimitMs: count
				.default(8000)
				.describe(
					"How long a reply waits for the one before it in the same channel before going anyway",
				),
			ownRepliesShown: count
				.default(5)
				.describe("Its own recent replies shown in full, the rest are hidden"),
			examplesPerReply: count
				.default(5)
				.describe("Liked examples put in the prompt for each reply"),
			claimAcceptChance: chance
				.default(0.4)
				.describe(
					'Chance it goes along when someone makes up something about its life ("din kusine i narvik"), which then becomes lore',
				),
			maxImages: count
				.default(4)
				.describe("Images sent to the model per reply"),
		})
		.prefault({}),
	reply: z
		.object({
			bestOf: z
				.int()
				.min(1)
				.default(4)
				.describe("Candidate replies written per message, the judge picks one"),
			temperature: z
				.number()
				.min(0)
				.max(2)
				.default(1)
				.describe("Temperature for writing replies"),
			maxOutputTokens: tokens
				.default(300)
				.describe("Token budget per candidate reply"),
			openerWords: z
				.int()
				.min(1)
				.default(2)
				.describe(
					"Words compared when checking if a reply starts like a recent one",
				),
			insultTailChance: chance
				.default(0.2)
				.describe(
					'Chance a reply ending in a tacked-on insult ("din idiot") is allowed',
				),
			dialJitter: z
				.number()
				.min(0)
				.max(DIAL_LIMIT)
				.default(0.5)
				.describe(
					"How much each dial wobbles per reply, except dials at the limit",
				),
			judgeTemperature: z
				.number()
				.min(0)
				.max(2)
				.default(0)
				.describe("Temperature for the judge picking the best reply"),
			judgeMaxTokens: tokens
				.default(300)
				.describe("Token budget for the judge"),
		})
		.prefault({}),
	lore: z
		.object({
			shown: count
				.default(25)
				.describe(
					"Most learned lore entries shown per reply, the ones the chat mentions first",
				),
			updateMaxTokens: tokens
				.default(800)
				.describe("Token budget for learning lore from a reply"),
			contextLines: count
				.default(8)
				.describe(
					'Chat lines the lore update reads around each reply, to know what "ja" agreed to',
				),
		})
		.prefault({}),
	profiles: z
		.object({
			updateEvery: z
				.int()
				.min(1)
				.default(15)
				.describe("Replies in a channel between profile updates"),
			updateMaxTokens: tokens
				.default(1500)
				.describe("Token budget for a profile update"),
		})
		.prefault({}),
	distill: z
		.object({
			maxTokens: tokens
				.default(2000)
				.describe("Token budget for distilling dials and tagging examples"),
		})
		.prefault({}),
	commands: z
		.object({
			prefix: z
				.string()
				.min(1)
				.default("-")
				.describe("Prefix for text commands"),
			devRole: z
				.string()
				.min(1)
				.default("dev")
				.describe("Role allowed to use the dials and lore commands"),
			musicChannelKeywords: z
				.array(z.string())
				.default(["bot", "music"])
				.describe(
					"Text commands only work in channels whose name contains one of these",
				),
		})
		.prefault({}),
	music: z
		.object({
			leaveOnEmptyMs: count
				.default(60_000)
				.describe("How long it stays in an empty voice channel"),
			leaveOnEndMs: count
				.default(5 * 60_000)
				.describe("How long it stays after the queue ends"),
			maxTrackRetries: count
				.default(1)
				.describe("Retries for a track that fails to play"),
			queuePageSize: z
				.int()
				.min(1)
				.max(25)
				.default(10)
				.describe("Tracks per page in the queue view"),
		})
		.prefault({}),
	words: z
		.object({
			common: wordList(
				"ikke bare også eller skal være sånn fordi etter over under dette hvis blir litt helt aldri alltid noen hele mens siden uten ditt mitt dine mine deres hvor hvem hvorfor hvordan kanskje fortsatt allerede faktisk igjen enda både skulle kunne ville have hadde sier gjør gjøre",
			).describe(
				"Words too common to count as reused or to point at a lore entry",
			),
			bareInsults: wordList(
				"idiot idioten dust tulling taper loser fiasko klovn tosk noob",
			).describe(
				'Insults that count as tacked on when they stand alone ("arne idiot")',
			),
			prepositions: wordList(
				"i på med til fra av for om hos mot under over etter ved uten",
			).describe('Words before "din" that make it a possessive, not an insult'),
			tailFillers: wordList(
				"igjen da eller nå også heller lenger altså liksom engang",
			).describe(
				'Words after "din …" that make it part of a sentence, not an insult',
			),
			partOfSentence: wordList(
				"en ei et som den det er var blir ble like for av med til fra",
			).describe(
				'Words before an insult that make it part of the sentence ("med en idiot")',
			),
		})
		.prefault({}),
});

export const personalitySchema = z.object({
	persona: z
		.string()
		.default("")
		.describe("Who the bot is, top of the system prompt"),
	chatRules: z
		.string()
		.default("")
		.describe("How it writes in chat, after the persona"),
	lore: z
		.string()
		.default("")
		.describe("The start of its made-up life, always in the prompt"),
	notes: z
		.string()
		.default("")
		.describe("Notes on bad replies, not read by the bot"),
});

export const youtubeCookiesSchema = z.object({
	text: z.string().default("").describe("YouTube cookies in Netscape format"),
});

export const settingSchemas = {
	taste: tasteSchema,
	"dial-overrides": dialOverridesSchema,
	tunables: tunablesSchema,
	prompts: promptsSchema,
	personality: personalitySchema,
	"youtube-cookies": youtubeCookiesSchema,
};

export type SettingKey = keyof typeof settingSchemas;
export type SettingValue<K extends SettingKey> = z.infer<
	(typeof settingSchemas)[K]
>;
export type Tunables = z.infer<typeof tunablesSchema>;
export type Personality = z.infer<typeof personalitySchema>;

export const botJobKinds = ["distill"] as const;
export type BotJobKind = (typeof botJobKinds)[number];

export type GuildChannel = { id: string; name: string; type: number };
export type GuildRole = { id: string; name: string };
