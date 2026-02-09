import { BaseCommand } from '../../structures/Command.ts';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import { ensureGuildConfig } from '../../database/guildConfig.ts';
import { logCommandAction } from '../../services/modLog.ts';

const DURATION_CHOICES = [
    { name: '1 minute', value: 60 },
    { name: '5 minutes', value: 300 },
    { name: '10 minutes', value: 600 },
    { name: '30 minutes', value: 1800 },
    { name: '1 hour', value: 3600 },
    { name: '6 hours', value: 21600 },
    { name: '12 hours', value: 43200 },
    { name: '1 day', value: 86400 },
    { name: '3 days', value: 259200 },
    { name: '1 week', value: 604800 },
];

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds} second(s)`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minute(s)`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour(s)`;
    return `${Math.floor(seconds / 86400)} day(s)`;
}

export default class MuteCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('mute')
                .setDescription('Mute or unmute a member (timeout)')
                .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
                .addSubcommand((sub) =>
                    sub
                        .setName('add')
                        .setDescription('Timeout a member')
                        .addUserOption((opt) =>
                            opt.setName('user').setDescription('User to mute').setRequired(true)
                        )
                        .addIntegerOption((opt) =>
                            opt
                                .setName('duration')
                                .setDescription('Timeout duration')
                                .setRequired(true)
                                .addChoices(...DURATION_CHOICES)
                        )
                        .addStringOption((opt) =>
                            opt.setName('reason').setDescription('Reason for the mute').setRequired(false)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('remove')
                        .setDescription('Remove timeout from a member')
                        .addUserOption((opt) =>
                            opt.setName('user').setDescription('User to unmute').setRequired(true)
                        )
                        .addStringOption((opt) =>
                            opt.setName('reason').setDescription('Reason for the unmute').setRequired(false)
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
            const duration = interaction.options.getInteger('duration', true);
            const reason = interaction.options.getString('reason') ?? 'No reason provided';

            const member = await interaction.guild?.members.fetch(user.id).catch(() => null);
            if (!member) {
                await interaction.reply({ content: 'User not found in this server.', flags: MessageFlags.Ephemeral });
                return;
            }

            if (user.id === interaction.user.id) {
                await interaction.reply({ content: 'You cannot mute yourself.', flags: MessageFlags.Ephemeral });
                return;
            }

            if (!member.moderatable) {
                await interaction.reply({ content: 'I cannot timeout this user. They may have a higher role than me.', flags: MessageFlags.Ephemeral });
                return;
            }

            const executorMember = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
            if (executorMember && member.roles.highest.position >= executorMember.roles.highest.position) {
                await interaction.reply({ content: 'You cannot mute a member with an equal or higher role.', flags: MessageFlags.Ephemeral });
                return;
            }

            const durationMs = duration * 1000;
            await member.timeout(durationMs, reason);

            const embed = new EmbedBuilder()
                .setTitle('Member Muted')
                .setColor(0xe67e22)
                .addFields(
                    { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Duration', value: formatDuration(duration), inline: true },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            try {
                await user.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(`Muted in ${interaction.guild?.name}`)
                            .setColor(0xe67e22)
                            .setDescription(`**Duration:** ${formatDuration(duration)}\n**Reason:** ${reason}`)
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
                action: 'mute',
                targetId: user.id,
                targetTag: user.tag,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                reason,
                duration,
            });
            return;
        }

        if (sub === 'remove') {
            const user = interaction.options.getUser('user', true);
            const reason = interaction.options.getString('reason') ?? 'No reason provided';

            const member = await interaction.guild?.members.fetch(user.id).catch(() => null);
            if (!member) {
                await interaction.reply({ content: 'User not found in this server.', flags: MessageFlags.Ephemeral });
                return;
            }

            if (!member.isCommunicationDisabled()) {
                await interaction.reply({ content: 'This user is not muted.', flags: MessageFlags.Ephemeral });
                return;
            }

            await member.timeout(null, reason);

            const embed = new EmbedBuilder()
                .setTitle('Member Unmuted')
                .setColor(0x2ecc71)
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
                action: 'unmute',
                targetId: user.id,
                targetTag: user.tag,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                reason,
            });
        }
    }
}
