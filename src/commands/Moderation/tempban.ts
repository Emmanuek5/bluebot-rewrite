import { BaseCommand } from '../../structures/Command.ts';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import TempbanModel from '../../database/models/Tempban.ts';
import { ensureGuildConfig } from '../../database/guildConfig.ts';
import { logCommandAction } from '../../services/modLog.ts';

const DURATION_CHOICES = [
    { name: '1 hour', value: 3600 },
    { name: '6 hours', value: 21600 },
    { name: '12 hours', value: 43200 },
    { name: '1 day', value: 86400 },
    { name: '3 days', value: 259200 },
    { name: '1 week', value: 604800 },
    { name: '2 weeks', value: 1209600 },
    { name: '1 month', value: 2592000 },
];

function formatDuration(seconds: number): string {
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minute(s)`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour(s)`;
    return `${Math.floor(seconds / 86400)} day(s)`;
}

export default class TempbanCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('tempban')
                .setDescription('Temporarily ban a user')
                .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
                .addUserOption((opt) =>
                    opt.setName('user').setDescription('User to tempban').setRequired(true)
                )
                .addIntegerOption((opt) =>
                    opt
                        .setName('duration')
                        .setDescription('Ban duration')
                        .setRequired(true)
                        .addChoices(...DURATION_CHOICES)
                )
                .addStringOption((opt) =>
                    opt.setName('reason').setDescription('Reason for the tempban').setRequired(false)
                )
                .addIntegerOption((opt) =>
                    opt
                        .setName('delete_days')
                        .setDescription('Days of messages to delete (0-7)')
                        .setMinValue(0)
                        .setMaxValue(7)
                        .setRequired(false)
                )
        );
    }

    public override async execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            return;
        }

        const user = interaction.options.getUser('user', true);
        const duration = interaction.options.getInteger('duration', true);
        const reason = interaction.options.getString('reason') ?? 'No reason provided';
        const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

        if (user.id === interaction.user.id) {
            await interaction.reply({ content: 'You cannot tempban yourself.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (user.id === client.user?.id) {
            await interaction.reply({ content: 'I cannot tempban myself.', flags: MessageFlags.Ephemeral });
            return;
        }

        const member = await interaction.guild?.members.fetch(user.id).catch(() => null);

        if (member) {
            if (!member.bannable) {
                await interaction.reply({ content: 'I cannot ban this user. They may have a higher role than me.', flags: MessageFlags.Ephemeral });
                return;
            }

            const executorMember = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
            if (executorMember && member.roles.highest.position >= executorMember.roles.highest.position) {
                await interaction.reply({ content: 'You cannot ban a member with an equal or higher role.', flags: MessageFlags.Ephemeral });
                return;
            }
        }

        try {
            await user.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`Temporarily Banned from ${interaction.guild?.name}`)
                        .setColor(0xcc0000)
                        .setDescription(`**Duration:** ${formatDuration(duration)}\n**Reason:** ${reason}`)
                        .setTimestamp(),
                ],
            });
        } catch {
            // User has DMs disabled
        }

        await interaction.guild?.members.ban(user, {
            reason: `[Tempban: ${formatDuration(duration)}] ${reason}`,
            deleteMessageSeconds: deleteDays * 86400,
        });

        const expiresAt = new Date(Date.now() + duration * 1000);
        await TempbanModel.create({
            guildId: interaction.guildId,
            userId: user.id,
            moderatorId: interaction.user.id,
            reason,
            expiresAt,
        });

        const embed = new EmbedBuilder()
            .setTitle('Member Temporarily Banned')
            .setColor(0xcc0000)
            .addFields(
                { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                { name: 'Duration', value: formatDuration(duration), inline: true },
                { name: 'Expires', value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`, inline: true },
                { name: 'Reason', value: reason }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        const config = await ensureGuildConfig(interaction.guildId);
        await logCommandAction({
            guild: interaction.guild!,
            config,
            action: 'tempban',
            targetId: user.id,
            targetTag: user.tag,
            moderatorId: interaction.user.id,
            moderatorTag: interaction.user.tag,
            reason,
            duration,
        });
    }
}
