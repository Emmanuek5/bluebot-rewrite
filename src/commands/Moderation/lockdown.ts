import { BaseCommand } from '../../structures/Command.ts';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, ChannelType } from 'discord.js';
import type { ChatInputCommandInteraction, Client, TextChannel } from 'discord.js';
import { ensureGuildConfig } from '../../database/guildConfig.ts';
import { logCommandAction } from '../../services/modLog.ts';

export default class LockdownCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('lockdown')
                .setDescription('Emergency server lockdown')
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                .addSubcommand((sub) =>
                    sub
                        .setName('start')
                        .setDescription('Lock all text channels')
                        .addStringOption((opt) =>
                            opt.setName('reason').setDescription('Reason for lockdown').setRequired(false)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('end')
                        .setDescription('Restore all channels locked by lockdown')
                )
        );
    }

    public override async execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            return;
        }

        const sub = interaction.options.getSubcommand();

        const config = await ensureGuildConfig(interaction.guildId);

        if (sub === 'start') {
            const reason = interaction.options.getString('reason') ?? 'Emergency lockdown';

            if (config.lockdownChannelIds.length > 0) {
                await interaction.reply({ content: 'Server is already in lockdown. Use `/lockdown end` to restore.', flags: MessageFlags.Ephemeral });
                return;
            }

            await interaction.deferReply();

            const guild = interaction.guild!;
            const everyoneRole = guild.roles.everyone;
            const channels = guild.channels.cache.filter(
                (ch) =>
                    (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement) &&
                    !(ch as TextChannel).permissionOverwrites.cache.get(everyoneRole.id)?.deny.has(PermissionFlagsBits.SendMessages)
            );

            const lockedIds: string[] = [];

            for (const channel of channels.values()) {
                try {
                    await (channel as TextChannel).permissionOverwrites.edit(everyoneRole, {
                        SendMessages: false,
                    }, { reason: `Lockdown by ${interaction.user.tag}: ${reason}` });
                    lockedIds.push(channel.id);
                } catch {
                    // Skip channels we can't edit
                }
            }

            config.lockdownChannelIds = lockedIds;
            await config.save();

            const embed = new EmbedBuilder()
                .setTitle('Server Lockdown Activated')
                .setColor(0xcc0000)
                .setDescription(`**${lockedIds.length}** channel(s) have been locked.`)
                .addFields(
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            await logCommandAction({
                guild: interaction.guild!,
                config,
                action: 'lockdown',
                targetId: interaction.guildId,
                targetTag: interaction.guild!.name,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                reason,
            });
            return;
        }

        if (sub === 'end') {
            if (config.lockdownChannelIds.length === 0) {
                await interaction.reply({ content: 'No active lockdown found.', flags: MessageFlags.Ephemeral });
                return;
            }

            await interaction.deferReply();

            const guild = interaction.guild!;
            const everyoneRole = guild.roles.everyone;
            let restored = 0;

            for (const channelId of config.lockdownChannelIds) {
                try {
                    const channel = guild.channels.cache.get(channelId);
                    if (channel && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)) {
                        await (channel as TextChannel).permissionOverwrites.edit(everyoneRole, {
                            SendMessages: null,
                        }, { reason: `Lockdown ended by ${interaction.user.tag}` });
                        restored++;
                    }
                } catch {
                    // Skip channels we can't edit
                }
            }

            config.lockdownChannelIds = [];
            await config.save();

            const embed = new EmbedBuilder()
                .setTitle('Server Lockdown Ended')
                .setColor(0x2ecc71)
                .setDescription(`**${restored}** channel(s) have been restored.`)
                .addFields({ name: 'Moderator', value: `${interaction.user.tag}`, inline: true })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    }
}
