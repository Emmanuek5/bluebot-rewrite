import { BaseCommand } from '../../structures/Command.ts';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, ChannelType } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import { ensureGuildConfig } from '../../database/guildConfig.ts';

export default class IgnoreCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('ignore')
                .setDescription('Manage channels ignored by automod')
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
                .addSubcommand((sub) =>
                    sub
                        .setName('add')
                        .setDescription('Add a channel to the ignore list')
                        .addChannelOption((opt) =>
                            opt
                                .setName('channel')
                                .setDescription('Channel to ignore')
                                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum)
                                .setRequired(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('remove')
                        .setDescription('Remove a channel from the ignore list')
                        .addChannelOption((opt) =>
                            opt
                                .setName('channel')
                                .setDescription('Channel to stop ignoring')
                                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum)
                                .setRequired(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('list')
                        .setDescription('List all ignored channels')
                )
        );
    }

    public override async execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            return;
        }

        const config = await ensureGuildConfig(interaction.guildId);
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const channel = interaction.options.getChannel('channel', true);

            if (config.ignoredChannelIds.includes(channel.id)) {
                await interaction.reply({ content: `${channel} is already ignored.`, flags: MessageFlags.Ephemeral });
                return;
            }

            config.ignoredChannelIds.push(channel.id);
            await config.save();

            await interaction.reply({
                content: `${channel} will now be ignored by automod.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (sub === 'remove') {
            const channel = interaction.options.getChannel('channel', true);
            const index = config.ignoredChannelIds.indexOf(channel.id);

            if (index === -1) {
                await interaction.reply({ content: `${channel} is not in the ignore list.`, flags: MessageFlags.Ephemeral });
                return;
            }

            config.ignoredChannelIds.splice(index, 1);
            await config.save();

            await interaction.reply({
                content: `${channel} is no longer ignored by automod.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (sub === 'list') {
            const ids = config.ignoredChannelIds;

            if (!ids.length) {
                await interaction.reply({ content: 'No channels are being ignored.', flags: MessageFlags.Ephemeral });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('Ignored Channels')
                .setColor(0x3498db)
                .setDescription(ids.map((id) => `<#${id}>`).join('\n'))
                .setFooter({ text: `${ids.length} channel(s)` });

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    }
}
