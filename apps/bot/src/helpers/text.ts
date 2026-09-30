import { escapeMarkdown } from "discord.js";

export function escapeLabel(text: string): string {
	return escapeMarkdown(text).replace(/[[\]]/g, "\\$&");
}

export function parseJsonObject(text: string): unknown {
	return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}
