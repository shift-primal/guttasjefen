import {
	type ChatInputCommandInteraction,
	GuildMember,
	type Message,
	MessageFlags,
} from "discord.js";
import type { Command, CommandContext } from "#/types";

export function fromInteraction(
	interaction: ChatInputCommandInteraction,
	command: Command,
): CommandContext | null {
	const { guild, member } = interaction;
	if (!guild || !(member instanceof GuildMember)) return null;

	return {
		guild,
		member,
		channel: interaction.channel,
		args: command.argument
			? (interaction.options.getString(command.argument.name) ?? "")
			: "",
		async defer() {
			await interaction.deferReply();
		},
		async reply(content, options) {
			if (interaction.deferred || interaction.replied) {
				await interaction.editReply({
					content,
					components: options?.components,
				});
			} else {
				await interaction.reply({
					content,
					components: options?.components,
					flags: options?.ephemeral ? MessageFlags.Ephemeral : undefined,
				});
			}
		},
	};
}

export function fromMessage(
	message: Message<true>,
	args: string,
): CommandContext | null {
	if (!message.member) return null;

	return {
		guild: message.guild,
		member: message.member,
		channel: message.channel,
		args,
		async defer() {
			if ("sendTyping" in message.channel) await message.channel.sendTyping();
		},
		async reply(content, options) {
			await message.reply({ content, components: options?.components });
		},
	};
}
