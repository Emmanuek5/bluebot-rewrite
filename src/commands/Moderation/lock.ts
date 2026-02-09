import { BaseCommand } from '../../structures/Command.ts';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, ChannelType } from 'discord.js';
import type { ChatInputCommandInteraction, Client, TextChannel } from 'discord.js';
import { ensureGuildConfig } from '../../database/guildConfig.ts';
import { logCommandAction } from '../../services/modLog.ts';

export default class LockCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('lock')
                .setDescription('Lock or unlock a channel')
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
                .addSubcommand((sub) =>
                    sub
                        .setName('add')
                        .setDescription('Lock a channel')
                        .addChannelOption((opt) =>
                            opt
                                .setName('channel')
                                .setDescription('Channel to lock (defaults to current)')
                                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum)
                                .setRequired(false)
                        )
                        .addStringOption((opt) =>
                            opt.setName('reason').setDescription('Reason for locking').setRequired(false)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('remove')
                        .setDescription('Unlock a channel')
                        .addChannelOption((opt) =>
                            opt
                                .setName('channel')
                                .setDescription('Channel to unlock (defaults to current)')
                                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum)
                                .setRequired(false)
                        )
                        .addStringOption((opt) =>
                            opt.setName('reason').setDescription('Reason for unlocking').setRequired(false)
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
        const targetChannel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
        const reason = interaction.options.getString('reason') ?? 'No reason provided';

        if (!targetChannel || !targetChannel.permissionOverwrites) {
            await interaction.reply({ content: 'Invalid channel.', flags: MessageFlags.Ephemeral });
            return;
        }

        const everyoneRole = interaction.guild?.roles.everyone;
        if (!everyoneRole) {
            await interaction.reply({ content: 'Could not resolve @everyone role.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (sub === 'add') {
            const currentOverwrite = targetChannel.permissionOverwrites.cache.get(everyoneRole.id);
            const alreadyDenied = currentOverwrite?.deny.has(PermissionFlagsBits.SendMessages);

            if (alreadyDenied) {
                await interaction.reply({ content: `${targetChannel} is already locked.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await targetChannel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: false,
                AddReactions: false,
                CreatePublicThreads: false,
            }, { reason: `Locked by ${interaction.user.tag}: ${reason}` });

            const embed = new EmbedBuilder()
                .setTitle('Channel Locked')
                .setColor(0xff6b6b)
                .setDescription(`${targetChannel} has been locked.`)
                .addFields(
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            if (targetChannel.id !== interaction.channelId) {
                try {
                    await targetChannel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('Channel Locked')
                                .setColor(0xff6b6b)
                                .setDescription(`This channel has been locked by a moderator.\n**Reason:** ${reason}`)
                                .setTimestamp(),
                        ],
                    });
                } catch {
                    // Cannot send to channel
                }
            }

            const config = await ensureGuildConfig(interaction.guildId);
            await logCommandAction({
                guild: interaction.guild!,
                config,
                action: 'lock',
                targetId: targetChannel.id,
                targetTag: `#${targetChannel.name}`,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                reason,
            });
            return;
        }

        if (sub === 'remove') {
            await targetChannel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: null,
                AddReactions: null,
                CreatePublicThreads: null,
            }, { reason: `Unlocked by ${interaction.user.tag}: ${reason}` });

            const embed = new EmbedBuilder()
                .setTitle('Channel Unlocked')
                .setColor(0x2ecc71)
                .setDescription(`${targetChannel} has been unlocked.`)
                .addFields(
                    { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            if (targetChannel.id !== interaction.channelId) {
                try {
                    await targetChannel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('Channel Unlocked')
                                .setColor(0x2ecc71)
                                .setDescription(`This channel has been unlocked.\n**Reason:** ${reason}`)
                                .setTimestamp(),
                        ],
                    });
                } catch {
                    // Cannot send to channel
                }
            }

            const config = await ensureGuildConfig(interaction.guildId);
            await logCommandAction({
                guild: interaction.guild!,
                config,
                action: 'unlock',
                targetId: targetChannel.id,
                targetTag: `#${targetChannel.name}`,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                reason,
            });
        }
    }
}
