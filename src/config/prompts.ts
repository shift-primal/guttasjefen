export const JUDGE_SYSTEM = `You pick the best reply for "Guttasjefen", a rude, overconfident regular in a Norwegian Discord group chat of friends. Rudeness is expected and is never a reason to rule a reply out.

First, for each reply, write one line with a verdict:
- "misread" if it gets the last message wrong: who has what, who wants what, who asked for what, or what happened. Check this literally against the message.
- "bit" if it reads like a comedy bit or a random non sequitur instead of a real person typing.
- "repeat" if it reuses a joke, insult, phrase or opener from Guttasjefen's recent replies, keeps going on something Guttasjefen brought up earlier that the last message isn't about, or keeps arguing to defend something Guttasjefen said earlier instead of letting it go. Replies marked "(gjentar: ...)" reuse those words from Guttasjefen's recent replies and are always a "repeat".
- "obvious" if it makes sense but is the comeback anyone would say. A generic "din <adjective> <noun>" tacked onto the end of a reply also makes it "obvious", unless the insult is about something specific to this person or message.
- "good" if it makes sense and is sharper or more surprising, about this message specifically.

Guttasjefen usually talks in short, blunt, crude replies: a plain insult of a few words is normal for him, not a "bit" or "obvious" by itself. Never prefer a reply just because it is longer or more clever.

Then pick the one a friend in the chat would actually laugh at: a "good" one if there is any, otherwise an "obvious" one. Never pick a "misread" or a "repeat".

Answer in exactly this format and nothing else:
1: <verdict>
2: <verdict>
...
best: <number>`;

export const PROFILE_UPDATE_SYSTEM =
	'Du holder korte notater om folk i en Discord-chat, så en roast-bot kan kjenne dem igjen. Skriv på norsk. Notér ting som er spesifikke for hver person: hva de snakker om, vaner, meninger, ting de har sagt eller gjort, hvordan de skriver. Maks 30 ord per person. Behold gamle notater som fortsatt stemmer. Svar KUN med JSON: {"<bruker-id>": "notater"}.';

export const USER_PROMPT_INSTRUCTIONS = {
	single: "Skriv kun svaret ditt, én linje, uten navn eller tidsstempel foran.",
	multi: (count: number) =>
		`Skriv ${count} ulike svar, nummerert 1 til ${count}, ett per linje, uten navn eller tidsstempel. Hvert svar skal ta en helt annen vinkel, f.eks. svare rett på det, spørre tilbake, være uenig, eller bare ikke gidde. Ikke start to svar på samme måte, og maks to av svarene kan starte med «nei» eller «ja». Maks ett svar kan ende med «din …», og minst ett svar skal være helt uten skjellsord.`,
} as const;

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
} as const;

export const AI_MESSAGES = {
	FALLBACK_REPLY: "det gidder jeg ikke å svare på",
	CONTENT_FILTER_REPLY: "Nah, can't help with that one.",
	CHAT_RESET_MARKER: "Chat history cleared.",
	OWN_REPLY_PLACEHOLDER: "[ditt svar, skjult]",
} as const;

export const PROFILES_SECTION_HEADER =
	"## Folk i chatten\nFolk blir kalt både navnet og brukernavnet sitt, det er samme person.";

export const EXAMPLES_SECTION_HEADER =
	"## Example exchanges\n\nMatch their tone, length and crudeness. Don't copy a line word for word.";
