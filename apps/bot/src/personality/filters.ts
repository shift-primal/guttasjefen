import { tunables } from "#/config/settings";

export function words(text: string): Set<string> {
	return new Set(text.toLowerCase().match(/[\p{L}\d]+/gu) ?? []);
}

export function reusedWords(
	reply: string,
	recent: string[],
	others: string,
	commonWords = new Set(tunables().words.common),
): string[] {
	const own = words(recent.join(" "));
	const theirs = words(others);
	return [...words(reply)].filter(
		(w) => w.length >= 4 && !commonWords.has(w) && own.has(w) && !theirs.has(w),
	);
}

function opener(text: string, count = tunables().reply.openerWords): string {
	return (text.toLowerCase().match(/[\p{L}\d]+/gu) ?? [])
		.slice(0, count)
		.join(" ");
}

export function sharesOpener(reply: string, past: string[]): boolean {
	const start = opener(reply);
	return start.includes(" ") && past.some((p) => opener(p) === start);
}

// Questions asking for a fact (a name, a place, a time), where "nei ..." or "ja ..." makes no sense as an opener
export function asksForFact(message: string): boolean {
	const text = message.toLowerCase();
	return (
		/(^|[^\p{L}])(hvem|hvor|når|hvilke[nt]?|hva)(?![\p{L}])/u.test(text) &&
		!/(^|[^\p{L}])hva (syns|synes|mener|tenker|sier)(?![\p{L}])/u.test(text)
	);
}

export function startsWithYesNo(reply: string): boolean {
	return /^(nei|ja)(?![\p{L}])/iu.test(reply.trim());
}

export function asksSomething(message: string): boolean {
	return (
		message.includes("?") || asksForFact(message) || /gjett/i.test(message)
	);
}

// "husker ikke", "glemt navnet", "spør noen andre": skips the question, even about its own made-up life
export function dodges(reply: string): boolean {
	return /^([\p{L}]+,?\s+)?(husker ikke|vet ikke|aner ikke|ingen anelse|(har )?glemt|gidder ikke|spør (heller )?(noen|en|de) ?(andre|annen)?)(?![\p{L}])/iu.test(
		reply.trim(),
	);
}

// "ser ut som noe kasper har skrapt opp" to Kasper himself: their name, but never "du"
export function talksAbout(reply: string, name: string): boolean {
	const said = words(reply);
	const named = [...words(name)].some((w) => w.length >= 3 && said.has(w));
	return (
		named && !["du", "deg", "din", "ditt", "dine"].some((w) => said.has(w))
	);
}

export function hasInsultTail(reply: string): boolean {
	const lists = tunables().words;
	const bareInsults = new Set(lists.bareInsults);
	const partOfSentence = new Set(lists.partOfSentence);
	const prepositions = new Set(lists.prepositions);
	const tailFillers = new Set(lists.tailFillers);
	const w = reply.toLowerCase().match(/[\p{L}\d-]+/gu) ?? [];
	// "han jobber med en idiot" says who someone is, it isn't tacked on
	const tacked = (i: number) =>
		bareInsults.has(w[i] as string) && !partOfSentence.has(w[i - 1] as string);
	if (w.length > 1 && tacked(w.length - 1)) return true;
	if (w.length <= 8 && w.slice(1, -1).some((_, j) => tacked(j + 1)))
		return true;
	for (let tail = 1; tail <= 3; tail++) {
		const i = w.length - tail - 1;
		const before = w[i - 1];
		if (i >= 1 && ["din", "ditt", "dine"].includes(w[i] as string))
			return (
				!prepositions.has(before as string) &&
				// "bursdagen din igjen" is just a possessive
				!/^\p{L}{2,}(en|et|a|ene)$/u.test(before as string) &&
				!w.slice(i + 1).some((x) => tailFillers.has(x))
			);
	}
	return false;
}
