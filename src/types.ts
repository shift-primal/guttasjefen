import type { Guild, GuildMember, TextBasedChannel } from "discord.js";

export interface CommandContext {
	guild: Guild;
	member: GuildMember;
	channel: TextBasedChannel | null;
	args: string;
	defer(): Promise<void>;
	reply(content: string, options?: { ephemeral?: boolean }): Promise<void>;
}

export interface Command {
	name: string;
	aliases?: string[];
	description: string;
	argument?: { name: string; description: string; required?: boolean };
	run(ctx: CommandContext): Promise<void>;
}
