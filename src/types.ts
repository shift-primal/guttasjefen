import type {
	ActionRowBuilder,
	ButtonBuilder,
	Guild,
	GuildMember,
	TextBasedChannel,
} from "discord.js";

export interface ReplyOptions {
	ephemeral?: boolean;
	components?: ActionRowBuilder<ButtonBuilder>[];
}

export interface CommandContext {
	guild: Guild;
	member: GuildMember;
	channel: TextBasedChannel | null;
	args: string;
	defer(): Promise<void>;
	reply(content: string, options?: ReplyOptions): Promise<void>;
}

export interface Command {
	name: string;
	aliases?: string[];
	description: string;
	argument?: { name: string; description: string; required?: boolean };
	run(ctx: CommandContext): Promise<void>;
}

export interface QueueMetadata {
	channel: TextBasedChannel | null;
}
