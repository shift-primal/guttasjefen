import {
	clampDial,
	DIAL_LIMIT,
	type Dial,
	type Taste,
} from "@guttasjefen/db/settings";
import { tunables } from "#/config/settings";

function gaussian() {
	return (
		Math.sqrt(-2 * Math.log(1 - Math.random())) *
		Math.cos(2 * Math.PI * Math.random())
	);
}

export function jitterTaste(
	taste: Taste | null,
	spread = tunables().reply.dialJitter,
): Taste | null {
	if (!taste || spread <= 0) return taste;
	const dials = Object.fromEntries(
		Object.entries(taste.dials).map(([name, dial]) => [
			name,
			Math.abs(dial.value) >= DIAL_LIMIT
				? dial
				: { ...dial, value: clampDial(dial.value + gaussian() * spread) },
		]),
	);
	return { ...taste, dials };
}

export function hasStrongLengthDial(taste: Taste | null) {
	return Object.entries(taste?.dials ?? {}).some(
		([name, { value }]) =>
			/length/i.test(name) && Math.abs(value) >= DIAL_LIMIT,
	);
}

export function strongDials(taste: Taste | null) {
	return Object.values(taste?.dials ?? {}).flatMap(({ value, low, high }) => {
		if (Math.abs(value) < DIAL_LIMIT) return [];
		return [value < 0 ? low : high];
	});
}

function describeDial({ value, low, high }: Dial) {
	// Rounds away from zero both ways, so -0.5 and 0.5 both lean
	const clamped = clampDial(value);
	const step = Math.sign(clamped) * Math.round(Math.abs(clamped));
	if (step === 0) return `between "${low}" and "${high}"`;
	const side = step < 0 ? low : high;
	return `${Math.abs(step) === DIAL_LIMIT ? "strongly" : "leaning"} toward "${side}"`;
}

export function describeTaste(taste: Taste | null) {
	if (!taste) return "";
	const dials = Object.entries(taste.dials).map(
		([name, dial]) => `- ${name}: ${describeDial(dial)}`,
	);
	return [taste.notes.trim(), dials.join("\n")].filter(Boolean).join("\n\n");
}
