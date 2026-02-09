import { BaseCommand } from '../../structures/Command.ts';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import { ensureGuildConfig } from '../../database/guildConfig.ts';
import { logCommandAction } from '../../services/modLog.ts';

export default class BanCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('ban')
                .setDescription('Ban or unban a user')
                .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
                .addSubcommand((sub) =>
                    sub
                        .setName('add')
                        .setDescription('Ban a user from the server')
                        .addUserOption((opt) =>
                            opt.setName('user').setDescription('User to ban').setRequired(true)
                        )
                        .addStringOption((opt) =>
                            opt.setName('reason').setDescription('Reason for the ban').setRequired(false)
                        )
                        .addIntegerOption((opt) =>
                            opt
                                .setName('delete_days')
                                .setDescription('Days of messages to delete (0-7)')
                                .setMinValue(0)
                                .setMaxValue(7)
                                .setRequired(false)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('remove')
                        .setDescription('Unban a user')
                        .addStringOption((opt) =>
                            opt.setName('user_id').setDescription('User ID to unban').setRequired(true).setAutocomplete(true)
                        )
                        .addStringOption((opt) =>
                            opt.setName('reason').setDescription('Reason for the unban').setRequired(false)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('list')
                        .setDescription('List current bans')
                )
        );
    }

    public override async execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            return;
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const user = interaction.options.getUser('user', true);
            const reason = interaction.options.getString('reason') ?? 'No reason provided';
            const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

            if (user.id === interaction.user.id) {
                await interaction.reply({ content: 'You cannot ban yourself.', flags: MessageFlags.Ephemeral });
                return;
            }

            if (user.id === client.user?.id) {
                await interaction.reply({ content: 'I cannot ban myself.', flags: MessageFlags.Ephemeral });
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
                            .setTitle(`Banned from ${interaction.guild?.name}`)
                            .setColor(0xcc0000)
                            .setDescription(`**Reason:** ${reason}`)
                            .setTimestamp(),
                    ],
                });
            } catch {
                // User has DMs disabled
            }

            await interaction.guild?.members.ban(user, {
                reason,
                deleteMessageSeconds: deleteDays * 86400,
            });

            const embed = new EmbedBuilder()
                .setTitle('Member Banned')
                .setColor(0xcc0000)
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
                action: 'ban',
                targetId: user.id,
                targetTag: user.tag,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                reason,
            });
            return;
        }

        if (sub === 'remove') {
            const userId = interaction.options.getString('user_id', true);
            const reason = interaction.options.getString('reason') ?? 'No reason provided';

            try {
                await interaction.guild?.members.unban(userId, reason);
            } catch {
                await interaction.reply({ content: 'Could not unban this user. They may not be banned.', flags: MessageFlags.Ephemeral });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('User Unbanned')
                .setColor(0x2ecc71)
                .addFields(
                    { name: 'User ID', value: userId, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            const config = await ensureGuildConfig(interaction.guildId);
            await logCommandAction({
                guild: interaction.guild!,
                config,
                action: 'unban',
                targetId: userId,
                targetTag: userId,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                reason,
            });
            return;
        }

        if (sub === 'list') {
            const bans = await interaction.guild?.bans.fetch({ limit: 20 });

            if (!bans || bans.size === 0) {
                await interaction.reply({ content: 'No bans found.', flags: MessageFlags.Ephemeral });
                return;
            }

            const lines = bans.map(
                (ban) => `\`${ban.user.id}\` — ${ban.user.tag} — ${ban.reason ?? 'No reason'}`
            );

            const embed = new EmbedBuilder()
                .setTitle('Server Bans')
                .setColor(0xcc0000)
                .setDescription(lines.join('\n'))
                .setFooter({ text: `Showing ${bans.size} ban(s)` });

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    }
}
