import { BaseCommand } from '../../structures/Command.ts';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client, TextChannel } from 'discord.js';
import { ensureGuildConfig } from '../../database/guildConfig.ts';
import { logCommandAction } from '../../services/modLog.ts';

export default class PurgeCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('purge')
                .setDescription('Bulk delete messages')
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
                .addIntegerOption((opt) =>
                    opt
                        .setName('amount')
                        .setDescription('Number of messages to delete (1-100)')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)
                )
                .addUserOption((opt) =>
                    opt.setName('user').setDescription('Only delete messages from this user').setRequired(false)
                )
                .addStringOption((opt) =>
                    opt.setName('reason').setDescription('Reason for purging').setRequired(false)
                )
        );
    }

    public override async execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            return;
        }

        const amount = interaction.options.getInteger('amount', true);
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') ?? 'No reason provided';
        const channel = interaction.channel as TextChannel;

        if (!channel || !('bulkDelete' in channel)) {
            await interaction.reply({ content: 'Cannot purge messages in this channel.', flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let messages = await channel.messages.fetch({ limit: Math.min(amount + 5, 100) });

        if (targetUser) {
            messages = messages.filter((msg) => msg.author.id === targetUser.id);
        }

        const toDelete = [...messages.values()].slice(0, amount);

        const now = Date.now();
        const fourteenDays = 14 * 24 * 60 * 60 * 1000;
        const deletable = toDelete.filter((msg) => now - msg.createdTimestamp < fourteenDays);

        if (!deletable.length) {
            await interaction.editReply({ content: 'No messages found to delete (messages older than 14 days cannot be bulk deleted).' });
            return;
        }

        const deleted = await channel.bulkDelete(deletable, true);

        const embed = new EmbedBuilder()
            .setTitle('Messages Purged')
            .setColor(0x3498db)
            .addFields(
                { name: 'Deleted', value: `${deleted.size} message(s)`, inline: true },
                { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
                { name: 'Channel', value: `${channel}`, inline: true }
            )
            .setTimestamp();

        if (targetUser) {
            embed.addFields({ name: 'Filtered by', value: `${targetUser.tag}`, inline: true });
        }

        embed.addFields({ name: 'Reason', value: reason });

        await interaction.editReply({ embeds: [embed] });

        const config = await ensureGuildConfig(interaction.guildId);
        await logCommandAction({
            guild: interaction.guild!,
            config,
            action: 'purge',
            targetId: channel.id,
            targetTag: `#${channel.name} (${deleted.size} msgs)`,
            moderatorId: interaction.user.id,
            moderatorTag: interaction.user.tag,
            reason,
        });
    }
}
