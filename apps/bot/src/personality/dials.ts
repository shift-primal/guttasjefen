import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	MessageFlags,
	StringSelectMenuBuilder,
	type StringSelectMenuInteraction,
} from "discord.js";
import { refuse } from "#/commands/guards";
import { hasRole, preview } from "#/helpers/discord";
import {
	DEV_ROLE,
	DIAL_JITTER,
	DIAL_LIMIT,
	DIAL_STEP,
	DIALS_ID_PREFIX,
} from "#/personality/config";
import {
	clampDial,
	type DialOverrides,
	loadTaste,
	loadTunedTaste,
	type Taste,
	updateDialOverrides,
} from "#/personality/taste";
import type { Command, CommandContext } from "#/types";

const ACTIONS = [
	"min",
	"down",
	"default",
	"up",
	"max",
	"toggle",
	"reset",
] as const;

type DialAction = (typeof ACTIONS)[number];
type DialInteraction = ButtonInteraction | StringSelectMenuInteraction;

const SLIDER_SIDE = Math.round(DIAL_LIMIT / DIAL_STEP);
// Keeps float noise (0.1 + 0.2) from pushing a step one notch too far
const EPSILON = 1e-9;

const formatDialValue = (value: number) => {
	const rounded = Number(value.toFixed(2));
	return rounded > 0 ? `+${rounded}` : String(rounded);
};

// Lights up from the middle toward the value, red when it's forced at ±DIAL_LIMIT
function slider(value: number) {
	const position = Math.round(clampDial(value) / DIAL_STEP);
	const fill = Math.abs(position) >= SLIDER_SIDE ? "🟥" : "🟧";
	return Array.from({ length: SLIDER_SIDE * 2 + 1 }, (_, i) => {
		const cell = i - SLIDER_SIDE;
		if (cell === 0) return "⬜";
		const lit =
			Math.sign(cell) === Math.sign(position) &&
			Math.abs(cell) <= Math.abs(position);
		return lit ? fill : "⬛";
	}).join("");
}

function isChanged(base: Taste, name: string, value: number) {
	const original = base.dials[name]?.value;
	return original !== undefined && original !== value;
}

function buttons(tuned: Taste, base: Taste, selected: string) {
	const value = tuned.dials[selected]?.value ?? 0;
	const button = (action: DialAction, label: string, style: ButtonStyle) =>
		new ButtonBuilder()
			.setCustomId(`${DIALS_ID_PREFIX}${action}:${selected}`)
			.setLabel(label)
			.setStyle(style);
	const anyChanged =
		tuned.enabled !== base.enabled ||
		Object.entries(tuned.dials).some(([name, dial]) =>
			isChanged(base, name, dial.value),
		);

	return [
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			button("min", "⏮️", ButtonStyle.Secondary).setDisabled(
				value <= -DIAL_LIMIT,
			),
			button("down", `◀️ -${DIAL_STEP}`, ButtonStyle.Primary).setDisabled(
				value <= -DIAL_LIMIT,
			),
			button("default", "↩️ Default", ButtonStyle.Secondary).setDisabled(
				!isChanged(base, selected, value),
			),
			button("up", `+${DIAL_STEP} ▶️`, ButtonStyle.Primary).setDisabled(
				value >= DIAL_LIMIT,
			),
			button("max", "⏭️", ButtonStyle.Secondary).setDisabled(
				value >= DIAL_LIMIT,
			),
		),
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			button(
				"toggle",
				tuned.enabled ? "🟢 Dials on" : "🔴 Dials off",
				tuned.enabled ? ButtonStyle.Success : ButtonStyle.Danger,
			),
			button("reset", "🔄 Reset all", ButtonStyle.Danger).setDisabled(
				!anyChanged,
			),
		),
	];
}

function renderDials(base: Taste, tuned: Taste, requested?: string) {
	const names = Object.keys(tuned.dials);
	const selected = requested && requested in tuned.dials ? requested : names[0];
	const width = Math.max(...names.map((name) => name.length));

	const lines = [
		`🎛️ **Humour dials** · ${tuned.enabled ? "🟢 on" : "🔴 off, replies ignore them"}`,
		"",
		...Object.entries(tuned.dials).map(([name, { value }]) => {
			const edited = isChanged(base, name, value) ? " ✏️" : "";
			const pointer = name === selected ? " 👈" : "";
			return `\`${name.padEnd(width)}\` ${slider(value)} **${formatDialValue(value)}**${edited}${pointer}`;
		}),
	];

	const dial = selected && tuned.dials[selected];
	if (selected && dial) {
		const original = base.dials[selected]?.value ?? dial.value;
		lines.push(
			"",
			`**${selected}**`,
			`⬅️ ${dial.low}`,
			`➡️ ${dial.high}`,
			`-# Default ${formatDialValue(original)} · ±${DIAL_LIMIT} forces that end in every reply, anything in between wobbles ±${DIAL_JITTER} per reply`,
		);
	}

	if (!selected) return { content: lines.join("\n"), components: [] };

	const picker = new StringSelectMenuBuilder()
		.setCustomId(`${DIALS_ID_PREFIX}pick`)
		.setPlaceholder("Pick a dial")
		.addOptions(
			Object.entries(tuned.dials).map(([name, { value, low, high }]) => ({
				label: `${name} (${formatDialValue(value)})`,
				description: preview(`${low} ↔ ${high}`, 95),
				value: name,
				default: name === selected,
			})),
		);

	return {
		content: lines.join("\n"),
		components: [
			new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(picker),
			...buttons(tuned, base, selected),
		],
	};
}

function parseDialsId(id: string) {
	const [action = "", name = ""] = id.slice(DIALS_ID_PREFIX.length).split(":");
	const known = ACTIONS.find((a) => a === action) ?? null;
	return { action: known, name };
}

// Steps snap to the DIAL_STEP grid, so +0.5 from 0.3 lands on 0.5, not 0.8
function change(
	action: DialAction,
	name: string,
	tuned: Taste,
): (overrides: DialOverrides) => DialOverrides {
	const value = tuned.dials[name]?.value ?? 0;
	const set = (next: number) => (overrides: DialOverrides) => ({
		...overrides,
		dials: { ...overrides.dials, [name]: clampDial(next) },
	});

	switch (action) {
		case "min":
			return set(-DIAL_LIMIT);
		case "max":
			return set(DIAL_LIMIT);
		case "down":
			return set((Math.ceil(value / DIAL_STEP - EPSILON) - 1) * DIAL_STEP);
		case "up":
			return set((Math.floor(value / DIAL_STEP + EPSILON) + 1) * DIAL_STEP);
		case "default":
			return (overrides) => {
				const { [name]: _, ...dials } = overrides.dials;
				return { ...overrides, dials };
			};
		case "toggle":
			return (overrides) => ({ ...overrides, enabled: !tuned.enabled });
		case "reset":
			return () => ({ dials: {} });
	}
}

export async function handleDials(interaction: DialInteraction) {
	if (!interaction.inCachedGuild()) return;
	if (!hasRole(interaction.member, DEV_ROLE)) {
		await interaction.reply({
			content: `Only the **${DEV_ROLE}** role can change the dials.`,
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	const base = await loadTaste();
	const tuned = await loadTunedTaste();
	if (!base || !tuned) {
		await interaction.update({
			content: "The dials are gone (no taste.json).",
			components: [],
		});
		return;
	}

	if (interaction.isStringSelectMenu()) {
		await interaction.update(renderDials(base, tuned, interaction.values[0]));
		return;
	}

	const { action, name } = parseDialsId(interaction.customId);
	if (!action) return;
	console.log(
		`[dials ${action}${name ? ` ${name}` : ""}] ${interaction.member.displayName}`,
	);
	await updateDialOverrides(base, change(action, name, tuned));

	const updated = (await loadTunedTaste()) ?? tuned;
	await interaction.update(renderDials(base, updated, name));
}

const USAGE = `\`<dial> <value>\` (-${DIAL_LIMIT} to ${DIAL_LIMIT}, several at once is fine), \`on\`, \`off\`, \`reset\` or \`reset <dial>\``;

// Exact name first, then a unique partial match, so "hostility" finds "hostility_level"
function findDial(taste: Taste, query: string): string {
	const names = Object.keys(taste.dials);
	const lower = query.toLowerCase();
	const exact = names.find((name) => name.toLowerCase() === lower);
	if (exact) return exact;
	const partial = names.filter((name) => name.toLowerCase().includes(lower));
	if (partial.length === 1 && partial[0]) return partial[0];
	throw new Error(
		partial.length
			? `"${query}" matches several dials: ${partial.join(", ")}.`
			: `No dial called "${query}". Dials: ${names.join(", ")}.`,
	);
}

function parseChanges(taste: Taste, tokens: string[]) {
	if (tokens.length % 2 !== 0) throw new Error(`Usage: ${USAGE}.`);
	const changes: Record<string, number> = {};
	for (let i = 0; i < tokens.length; i += 2) {
		const name = findDial(taste, tokens[i] as string);
		const value = Number(tokens[i + 1]);
		if (!Number.isFinite(value)) {
			throw new Error(`"${tokens[i + 1]}" isn't a number.`);
		}
		changes[name] = clampDial(value);
	}
	return changes;
}

// Returns the new overrides, or throws with a message for the user
function applyArgs(
	taste: Taste,
	overrides: DialOverrides,
	tokens: string[],
): DialOverrides {
	const [first, ...rest] = tokens;
	const keyword = first?.toLowerCase();
	if (keyword === "on" || keyword === "off") {
		if (rest.length) throw new Error(`Usage: ${USAGE}.`);
		return { ...overrides, enabled: keyword === "on" };
	}
	if (keyword === "reset") {
		if (!rest.length) return { dials: {} };
		const dials = { ...overrides.dials };
		for (const query of rest) delete dials[findDial(taste, query)];
		return { ...overrides, dials };
	}
	return {
		...overrides,
		dials: { ...overrides.dials, ...parseChanges(taste, tokens) },
	};
}

async function run(ctx: CommandContext) {
	if (!hasRole(ctx.member, DEV_ROLE)) {
		return refuse(ctx, `Only the **${DEV_ROLE}** role can use the dials.`);
	}
	const base = await loadTaste();
	if (!base) {
		return refuse(ctx, "No taste.json yet, run `pnpm distill:taste` first.");
	}

	const tokens = ctx.args.split(/[\s=]+/).filter(Boolean);
	// Opens the panel on the first dial the command touched, if any
	let touched: string | undefined;
	if (tokens.length) {
		try {
			await updateDialOverrides(base, (overrides) =>
				applyArgs(base, overrides, tokens),
			);
			const [first = "", second] = tokens;
			if (first.toLowerCase() === "reset") {
				if (second) touched = findDial(base, second);
			} else if (!["on", "off"].includes(first.toLowerCase())) {
				touched = findDial(base, first);
			}
		} catch (error) {
			return refuse(ctx, (error as Error).message);
		}
	}

	const tuned = await loadTunedTaste();
	if (!tuned) return;
	const { content, components } = renderDials(base, tuned, touched);
	await ctx.reply(content, { components });
}

export const dials: Command = {
	name: "dials",
	aliases: ["dial", "taste"],
	description: `Open the AI's humour dials panel (${DEV_ROLE} role only)`,
	argument: {
		name: "settings",
		description: `Quick set, e.g. "hostility 2 absurdity -1", "off", "reset" (empty just opens the panel)`,
	},
	run,
};
