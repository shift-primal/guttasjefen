import type { Guild, GuildMember, TextBasedChannel } from "discord.js";

/** What a command sees, regardless of whether it came from `/cmd` or `-cmd`. */
export interface CommandContext {
	guild: Guild;
	member: GuildMember;
	channel: TextBasedChannel | null;
	/** Everything after the command name (slash: the argument option's value). */
	args: string;
	/** Signal that the reply may take a while. */
	defer(): Promise<void>;
	/** Reply, or edit the reply if `defer()` was called. `ephemeral` only applies to slash. */
	reply(content: string, options?: { ephemeral?: boolean }): Promise<void>;
}

export interface Command {
	name: string;
	/** Extra prefix names, e.g. "p" for `-p`. Slash commands only use `name`. */
	aliases?: string[];
	description: string;
	/** The single free-text argument, if any (`/play song:...` / `-play ...`). */
	argument?: { name: string; description: string; required?: boolean };
	run(ctx: CommandContext): Promise<void>;
}
