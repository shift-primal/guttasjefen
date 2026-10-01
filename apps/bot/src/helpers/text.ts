import { escapeMarkdown } from "discord.js";

export function escapeLabel(text: string): string {
	return escapeMarkdown(text).replace(/[[\]]/g, "\\$&");
}

export function parseJsonObject(text: string): unknown {
	return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}

export function fill(
	template: string,
	values: Record<string, string | number>,
) {
	return template.replace(/\{(\w+)\}/g, (match, key: string) =>
		key in values ? String(values[key]) : match,
	);
}
