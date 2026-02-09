import { BaseCommand } from '../../structures/Command.ts';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import { ensureGuildConfig } from '../../database/guildConfig.ts';
import { logCommandAction } from '../../services/modLog.ts';

export default class KickCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('kick')
                .setDescription('Kick a member from the server')
                .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
                .addUserOption((opt) =>
                    opt.setName('user').setDescription('User to kick').setRequired(true)
                )
                .addStringOption((opt) =>
                    opt.setName('reason').setDescription('Reason for the kick').setRequired(false)
                )
        );
    }

    public override async execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            return;
        }

        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') ?? 'No reason provided';
        const member = await interaction.guild?.members.fetch(user.id).catch(() => null);

        if (!member) {
            await interaction.reply({ content: 'User not found in this server.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (user.id === interaction.user.id) {
            await interaction.reply({ content: 'You cannot kick yourself.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (user.id === client.user?.id) {
            await interaction.reply({ content: 'I cannot kick myself.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (!member.kickable) {
            await interaction.reply({ content: 'I cannot kick this user. They may have a higher role than me.', flags: MessageFlags.Ephemeral });
            return;
        }

        const executorMember = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
        if (executorMember && member.roles.highest.position >= executorMember.roles.highest.position) {
            await interaction.reply({ content: 'You cannot kick a member with an equal or higher role.', flags: MessageFlags.Ephemeral });
            return;
        }

        try {
            await user.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`Kicked from ${interaction.guild?.name}`)
                        .setColor(0xff6b6b)
                        .setDescription(`**Reason:** ${reason}`)
                        .setTimestamp(),
                ],
            });
        } catch {
            // User has DMs disabled
        }

        await member.kick(reason);

        const embed = new EmbedBuilder()
            .setTitle('Member Kicked')
            .setColor(0xff6b6b)
            .addFields(
                { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                { name: 'Reason', value: reason }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        const config = await ensureGuildConfig(interaction.guildId);
        await logCommandAction({
            guild: interaction.guild!,
            config,
            action: 'kick',
            targetId: user.id,
            targetTag: user.tag,
            moderatorId: interaction.user.id,
            moderatorTag: interaction.user.tag,
            reason,
        });
    }
}
