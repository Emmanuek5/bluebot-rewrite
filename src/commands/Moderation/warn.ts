import { BaseCommand } from '../../structures/Command.ts';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import WarningModel from '../../database/models/Warning.ts';
import { ensureGuildConfig } from '../../database/guildConfig.ts';
import { logCommandAction } from '../../services/modLog.ts';

export default class WarnCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('warn')
                .setDescription('Manage user warnings')
                .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                .addSubcommand((sub) =>
                    sub
                        .setName('add')
                        .setDescription('Warn a user')
                        .addUserOption((opt) =>
                            opt.setName('user').setDescription('User to warn').setRequired(true)
                        )
                        .addStringOption((opt) =>
                            opt.setName('reason').setDescription('Reason for the warning').setRequired(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('list')
                        .setDescription('List warnings for a user')
                        .addUserOption((opt) =>
                            opt.setName('user').setDescription('User to view').setRequired(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('remove')
                        .setDescription('Remove a specific warning')
                        .addStringOption((opt) =>
                            opt.setName('id').setDescription('Warning ID').setRequired(true).setAutocomplete(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('clear')
                        .setDescription('Clear all warnings for a user')
                        .addUserOption((opt) =>
                            opt.setName('user').setDescription('User to clear').setRequired(true)
                        )
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
            const reason = interaction.options.getString('reason', true);

            if (user.bot) {
                await interaction.reply({ content: 'You cannot warn bots.', flags: MessageFlags.Ephemeral });
                return;
            }

            const warning = await WarningModel.create({
                guildId: interaction.guildId,
                userId: user.id,
                moderatorId: interaction.user.id,
                reason,
            });

            const count = await WarningModel.countDocuments({
                guildId: interaction.guildId,
                userId: user.id,
            });

            const embed = new EmbedBuilder()
                .setTitle('Warning Issued')
                .setColor(0xffa500)
                .addFields(
                    { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Reason', value: reason },
                    { name: 'Total Warnings', value: `${count}`, inline: true },
                    { name: 'Warning ID', value: warning.id, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            try {
                await user.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(`Warning in ${interaction.guild?.name}`)
                            .setColor(0xffa500)
                            .setDescription(`**Reason:** ${reason}\n**Total Warnings:** ${count}`)
                            .setTimestamp(),
                    ],
                });
            } catch {
                // User has DMs disabled
            }

            const config = await ensureGuildConfig(interaction.guildId);
            await logCommandAction({
                guild: interaction.guild!,
                config,
                action: 'warn',
                targetId: user.id,
                targetTag: user.tag,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                reason,
            });
            return;
        }

        if (sub === 'list') {
            const user = interaction.options.getUser('user', true);
            const warnings = await WarningModel.find({
                guildId: interaction.guildId,
                userId: user.id,
            })
                .sort({ createdAt: -1 })
                .limit(15);

            if (!warnings.length) {
                await interaction.reply({
                    content: `${user.tag} has no warnings.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const lines = warnings.map(
                (w) =>
                    `\`${w.id}\` — ${w.reason} (by <@${w.moderatorId}>, <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>)`
            );

            const embed = new EmbedBuilder()
                .setTitle(`Warnings for ${user.tag}`)
                .setColor(0xffa500)
                .setDescription(lines.join('\n'))
                .setFooter({ text: `${warnings.length} warning(s)` });

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        if (sub === 'remove') {
            const id = interaction.options.getString('id', true);
            const result = await WarningModel.findOneAndDelete({
                _id: id,
                guildId: interaction.guildId,
            });

            if (!result) {
                await interaction.reply({ content: 'Warning not found.', flags: MessageFlags.Ephemeral });
                return;
            }

            await interaction.reply({ content: `Warning \`${id}\` removed.`, flags: MessageFlags.Ephemeral });
            return;
        }

        if (sub === 'clear') {
            const user = interaction.options.getUser('user', true);
            const result = await WarningModel.deleteMany({
                guildId: interaction.guildId,
                userId: user.id,
            });

            await interaction.reply({
                content: `Cleared ${result.deletedCount} warning(s) for ${user.tag}.`,
                flags: MessageFlags.Ephemeral,
            });
        }
    }
}
