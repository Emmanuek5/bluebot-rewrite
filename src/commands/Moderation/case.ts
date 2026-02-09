import { BaseCommand } from '../../structures/Command.ts';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import ModerationCaseModel from '../../database/models/ModerationCase.ts';

const ACTION_COLORS: Record<string, number> = {
    warn: 0xffa500,
    kick: 0xff6b6b,
    ban: 0xcc0000,
    unban: 0x2ecc71,
    mute: 0xe67e22,
    unmute: 0x2ecc71,
    tempban: 0xcc0000,
    lock: 0xff6b6b,
    unlock: 0x2ecc71,
    lockdown: 0xcc0000,
    purge: 0x3498db,
    automod: 0xff6b6b,
};

function buildCaseEmbed(c: any): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle(`Case #${c.caseNumber} — ${c.action.toUpperCase()}`)
        .setColor(ACTION_COLORS[c.action] ?? 0x95a5a6)
        .addFields(
            { name: 'Target', value: `${c.targetTag} (${c.targetId})`, inline: true },
            { name: 'Moderator', value: `${c.moderatorTag} (${c.moderatorId})`, inline: true },
            { name: 'Reason', value: c.reason }
        )
        .setTimestamp(c.createdAt);

    if (c.duration) {
        const label = c.duration < 3600
            ? `${Math.floor(c.duration / 60)}m`
            : c.duration < 86400
                ? `${Math.floor(c.duration / 3600)}h`
                : `${Math.floor(c.duration / 86400)}d`;
        embed.addFields({ name: 'Duration', value: label, inline: true });
    }

    return embed;
}

export default class CaseCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('case')
                .setDescription('View and manage moderation cases')
                .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                .addSubcommand((sub) =>
                    sub
                        .setName('view')
                        .setDescription('View a specific case')
                        .addStringOption((opt) =>
                            opt.setName('number').setDescription('Case number').setRequired(true).setAutocomplete(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('edit')
                        .setDescription('Edit the reason for a case')
                        .addStringOption((opt) =>
                            opt.setName('number').setDescription('Case number').setRequired(true).setAutocomplete(true)
                        )
                        .addStringOption((opt) =>
                            opt.setName('reason').setDescription('New reason').setRequired(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('search')
                        .setDescription('Search cases for a user')
                        .addUserOption((opt) =>
                            opt.setName('user').setDescription('User to search').setRequired(true)
                        )
                        .addStringOption((opt) =>
                            opt
                                .setName('action')
                                .setDescription('Filter by action type')
                                .setRequired(false)
                                .addChoices(
                                    { name: 'Warn', value: 'warn' },
                                    { name: 'Kick', value: 'kick' },
                                    { name: 'Ban', value: 'ban' },
                                    { name: 'Unban', value: 'unban' },
                                    { name: 'Mute', value: 'mute' },
                                    { name: 'Unmute', value: 'unmute' },
                                    { name: 'Tempban', value: 'tempban' }
                                )
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

        if (sub === 'view') {
            const num = parseInt(interaction.options.getString('number', true), 10);
            if (isNaN(num) || num < 1) {
                await interaction.reply({ content: 'Invalid case number.', flags: MessageFlags.Ephemeral });
                return;
            }
            const modCase = await ModerationCaseModel.findOne({ guildId: interaction.guildId, caseNumber: num });

            if (!modCase) {
                await interaction.reply({ content: `Case #${num} not found.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await interaction.reply({ embeds: [buildCaseEmbed(modCase)], flags: MessageFlags.Ephemeral });
            return;
        }

        if (sub === 'edit') {
            const num = parseInt(interaction.options.getString('number', true), 10);
            if (isNaN(num) || num < 1) {
                await interaction.reply({ content: 'Invalid case number.', flags: MessageFlags.Ephemeral });
                return;
            }
            const reason = interaction.options.getString('reason', true);

            const modCase = await ModerationCaseModel.findOneAndUpdate(
                { guildId: interaction.guildId, caseNumber: num },
                { reason },
                { new: true }
            );

            if (!modCase) {
                await interaction.reply({ content: `Case #${num} not found.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await interaction.reply({
                content: `Case #${num} reason updated.`,
                embeds: [buildCaseEmbed(modCase)],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (sub === 'search') {
            const user = interaction.options.getUser('user', true);
            const actionFilter = interaction.options.getString('action');

            const query: Record<string, any> = {
                guildId: interaction.guildId,
                targetId: user.id,
            };
            if (actionFilter) query.action = actionFilter;

            const cases = await ModerationCaseModel.find(query)
                .sort({ caseNumber: -1 })
                .limit(15)
                .lean();

            if (!cases.length) {
                await interaction.reply({
                    content: `No cases found for ${user.tag}${actionFilter ? ` (${actionFilter})` : ''}.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const lines = cases.map(
                (c) => `\`#${c.caseNumber}\` **${c.action}** — ${c.reason} (<t:${Math.floor(new Date(c.createdAt!).getTime() / 1000)}:R>)`
            );

            const embed = new EmbedBuilder()
                .setTitle(`Cases for ${user.tag}`)
                .setColor(0x3498db)
                .setDescription(lines.join('\n'))
                .setFooter({ text: `Showing ${cases.length} case(s)` });

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    }
}
