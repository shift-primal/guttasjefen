import { parseArgs } from "node:util";
import { refreshSettings } from "#/config/settings";
import { db } from "#/db";
import { distill } from "#/personality/distill";

await refreshSettings();

const { values } = parseArgs({
	options: { fresh: { type: "boolean", default: false } },
});

const { taste, distilled, tagged, failed, total } = await distill({
	fresh: values.fresh,
});

console.log(`\n${taste.notes}\n`);
for (const [name, { value, low, high }] of Object.entries(taste.dials)) {
	console.log(
		`${name.padEnd(20)} ${String(value).padStart(4)}   ${low} ↔ ${high}`,
	);
}
console.log(
	`\n${distilled ? "Wrote" : "Kept"} the taste, tagged ${tagged} of ${total} examples${failed ? ` (${failed} failed, rerun to retry)` : ""}`,
);
await db.$client.end();
