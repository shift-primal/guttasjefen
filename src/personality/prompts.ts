export const JUDGE_SYSTEM = `You pick the best reply for "Guttasjefen", a rude, overconfident regular in a Norwegian Discord group chat of friends. Rudeness is expected and is never a reason to rule a reply out.

First, for each reply, write one line: what it means as an answer to the last message in a few plain words, then a verdict:
- "misread" if it gets the last message wrong: who has what, who wants what, who asked for what, or what happened. Check this literally against the message. Also "misread" if it talks about the person it's replying to by name, as if they weren't there ("ser ut som noe kasper har laget" to Kasper himself), instead of to them with "du".
- "nonsense" if you can't say in plain words how it follows from the last message, or it only works if you get a word wrong (like asking what something tastes like when nobody ate anything).
- "broken" if it has a misspelled word (like "spur" for "spør" or "hetter" for "heter") or a sentence that doesn't make sense as Norwegian. Casual spelling like lowercase or "hu" is fine.
- "dodge" if the last message asks something directly (a name, a guess, a tip, an opinion) and the reply doesn't answer it: it only insults, refuses, asks what they mean, throws the question back ("hva tror du selv", "hva spiser du da"), says "nobody" or "none of you" when asked to pick someone, says it forgot or doesn't know, or sends them to ask someone else. Guttasjefen always knows about his own life (his friends, his past) because he makes it up, so "husker ikke" about his own life is a "dodge". Answering a different question also counts ("who do you like least" when they asked who he likes best).
- "bit" if it reads like a comedy bit or a random non sequitur instead of a real person typing.
- "repeat" if it reuses a joke, insult, phrase or opener from Guttasjefen's recent replies, keeps going on something Guttasjefen brought up earlier that the last message isn't about, or keeps arguing to defend something Guttasjefen said earlier instead of letting it go. Replies marked "(gjentar: ...)" reuse those words from Guttasjefen's recent replies and are always a "repeat".
- "obvious" if it makes sense but is the comeback anyone would say. A generic "din <adjective> <noun>" tacked onto the end of a reply also makes it "obvious", unless the insult is about something specific to this person or message.
- "good" if it makes sense and is sharper or more surprising, about this message specifically.

Guttasjefen usually talks in short, blunt, crude replies: a plain insult of a few words is normal for him, not a "bit" or "obvious" by itself. Never prefer a reply just because it is longer or more clever.

Then pick the one a friend in the chat would actually laugh at: a "good" one if there is any, otherwise an "obvious" one, and a "dodge" only if nothing else is left. Never pick a "misread", "nonsense", "broken" or "repeat".

Answer in exactly this format and nothing else:
1: <what it means> → <verdict>
2: <what it means> → <verdict>
...
best: <number>`;

export const PROFILE_UPDATE_SYSTEM =
	'Du holder korte notater om folk i en Discord-chat, så en roast-bot kan kjenne dem igjen. Skriv på norsk. Notér ting som er spesifikke for hver person: hva de snakker om, vaner, meninger, ting de har sagt eller gjort, hvordan de skriver. Maks 30 ord per person. Behold gamle notater som fortsatt stemmer. Svar KUN med JSON: {"<bruker-id>": "notater"}.';

export const USER_PROMPT_INSTRUCTIONS = {
	single: "Skriv kun svaret ditt, én linje, uten navn eller tidsstempel foran.",
	multi: (count: number) =>
		`Skriv ${count} ulike svar, nummerert 1 til ${count}, ett per linje, uten navn eller tidsstempel. Hvert svar skal ta en helt annen vinkel. Spør de om noe (et navn, en gjetning, en mening), skal ALLE svarene faktisk svare på det, bare på hver sin måte: finn på et svar om du må, og aldri «husker ikke», «vet ikke», «ingen av dere», «hva tror du selv» eller «hva mener du». Spør de ikke om noe, kan en vinkel f.eks. være å være uenig, overdrive, eller bare ikke gidde. Ikke start to svar på samme måte, og start aldri med «nei» eller «ja» med mindre meldingen faktisk er et ja/nei-spørsmål, og da maks to av svarene. Maks ett svar kan ende med «din …», og minst ett svar skal være helt uten skjellsord.`,
} as const;

export const STRONG_DIALS_INSTRUCTION = (dials: string[], count: number) =>
	`Gå helt inn for dette i ${count > 1 ? "alle svarene" : "svaret"}: ${dials.map((d) => `«${d}»`).join(", ")}. Det gjelder foran reglene over om stil, tone og lengde, men ikke foran reglene om å svare på det de faktisk spør om, eller om variasjon: ${count > 1 ? "spør de om noe, skal alle svarene faktisk svare på det (finn på et svar om du må), hvert svar skal ha sin egen idé, og ingen to svar kan dele bilde, poeng eller åpning" : "spør de om noe, svar på det (finn på et svar om du må), og finn en idé som er spesifikk for akkurat denne meldingen, ikke den første og mest opplagte"}.`;

export const REPLY_LENGTH_DESCRIPTIONS = {
	SHORT: "1–5 ord",
	MEDIUM: "rundt 4–10 ord",
	LONG: "rundt 10–20 ord",
	RANT: "et lite rant på 25–40 ord, fortsatt én linje",
} as const;

export function getReplyLength(message: string): string {
	const roll = Math.random();
	if (roll < 0.5) return REPLY_LENGTH_DESCRIPTIONS.SHORT;
	if (roll < 0.8 || message.split(/\s+/).length < 4) {
		return REPLY_LENGTH_DESCRIPTIONS.MEDIUM;
	}
	if (roll < 0.95) return REPLY_LENGTH_DESCRIPTIONS.LONG;
	return REPLY_LENGTH_DESCRIPTIONS.RANT;
}

export const IMAGE_PROMPT_LABELS = {
	direct: (name: string) => `Bilder fra meldingen til ${name}:`,
	replied: (name: string, author: string) =>
		`Bilder fra meldingen ${name} svarer på (sendt av ${author}):`,
	earlier: (author: string, time: string) =>
		`Siste bilde i chatten (sendt av ${author} kl ${time}):`,
} as const;

export const AI_MESSAGES = {
	FALLBACK_REPLY: "det gidder jeg ikke å svare på",
	CONTENT_FILTER_REPLY: "Nah, can't help with that one.",
	CHAT_RESET_MARKER: "Chat history cleared.",
	OWN_REPLY_PLACEHOLDER: "[ditt svar, skjult]",
} as const;

export const PROFILES_SECTION_HEADER =
	"## Folk i chatten\nFolk blir kalt både navnet og brukernavnet sitt, det er samme person.";

export const TASTE_SECTION_HEADER =
	"## Humour settings\n\nWhat's funny here right now. Aim your replies at these settings. A setting marked \"strongly\" overrides anything above about style, tone or length. They are about how you're funny, never about whether you answer: when someone asks you something, you still answer it.";

export const JUDGE_STRONG_DIALS_LABEL =
	'Guttasjefen is set to go hard in these directions right now. A reply is never a "bit" just for doing that, but every other verdict rule still applies:';

export const DISTILL_DIALS_SYSTEM = `You study what one person finds funny. You get replies they liked, as "message → reply", and maybe some they disliked.

Describe their sense of humour as 5 to 8 dials: independent axes the replies vary along, that someone could turn up or down to steer a writer. Dials are about how the joke works (how specific it is to the message, how absurd, how much effort it shows, how it attacks, how long it is...), never about topics. Every dial must actually vary across the liked replies; skip anything they all share. A length dial is only about length, never attitude (not "one word, dismissive"). Dials must not overlap: each end describes one thing only, never something another dial covers (e.g. if there is a dark humour dial, an absurdity dial is about surreal logic, not death or cruelty).

Also write "notes": 2 to 4 sentences on what the liked replies have in common, and what separates them from the disliked ones if there are any.

Answer ONLY with JSON:
{"notes": "...", "dials": {"snake_case_name": {"low": "what one end looks like, a few words", "high": "what the other end looks like, a few words"}}}`;

export const TAG_EXAMPLES_SYSTEM = `You rate replies on humour dials. Each dial goes from -2 (fully its "low" end) to 2 (fully its "high" end), with 0 in between. Rate every reply on every dial, in whole numbers, in the order the dials are listed.

Answer ONLY with JSON, one line per reply: {"<reply number>": [<first dial>, <second dial>, ...], ...}`;

export const EXAMPLES_SECTION_HEADER =
	"## Example exchanges\n\nMatch their tone, length and crudeness. Don't copy a line word for word.";
