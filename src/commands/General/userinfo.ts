import { BaseCommand } from '../../structures/Command.ts';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import WarningModel from '../../database/models/Warning.ts';
import ModerationCaseModel from '../../database/models/ModerationCase.ts';

export default class UserInfoCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('userinfo')
                .setDescription('View information about a user')
                .addUserOption((opt) =>
                    opt.setName('user').setDescription('User to view (defaults to yourself)').setRequired(false)
                )
        );
    }

    public override async execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
        const user = interaction.options.getUser('user') ?? interaction.user;
        const member = interaction.inGuild()
            ? await interaction.guild?.members.fetch(user.id).catch(() => null)
            : null;

        const embed = new EmbedBuilder()
            .setTitle(user.tag)
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .setColor(member?.displayColor ?? 0x3498db)
            .addFields(
                { name: 'ID', value: user.id, inline: true },
                { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true },
                { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true }
            );

        if (member) {
            embed.addFields(
                { name: 'Joined Server', value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Unknown', inline: true },
                { name: 'Nickname', value: member.nickname ?? 'None', inline: true },
                { name: 'Boosting Since', value: member.premiumSince ? `<t:${Math.floor(member.premiumSince.getTime() / 1000)}:R>` : 'Not boosting', inline: true }
            );

            if (member.isCommunicationDisabled()) {
                embed.addFields({
                    name: 'Timeout Until',
                    value: `<t:${Math.floor(member.communicationDisabledUntilTimestamp! / 1000)}:R>`,
                    inline: true,
                });
            }

            const roles = member.roles.cache
                .filter((r) => r.id !== interaction.guildId)
                .sort((a, b) => b.position - a.position)
                .map((r) => `${r}`)
                .slice(0, 20);

            if (roles.length) {
                embed.addFields({ name: `Roles (${roles.length})`, value: roles.join(', ') });
            }
        }

        if (interaction.inGuild()) {
            const [warningCount, caseCount] = await Promise.all([
                WarningModel.countDocuments({ guildId: interaction.guildId, userId: user.id }),
                ModerationCaseModel.countDocuments({ guildId: interaction.guildId, targetId: user.id }),
            ]);

            embed.addFields(
                { name: 'Warnings', value: `${warningCount}`, inline: true },
                { name: 'Mod Cases', value: `${caseCount}`, inline: true }
            );
        }

        embed.setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}
