import { EmbedBuilder, type Message, type TextBasedChannel } from 'discord.js';
import type { GuildConfig } from '../database/models/GuildConfig.ts';

function resolveLogChannel(message: Message, config: GuildConfig): TextBasedChannel | null {
    const channelId = config.logging?.modLogChannelId;
    if (!channelId || !message.guild) return null;
    const channel = message.guild.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) return null;
    return channel;
}

export async function logModerationAction(options: {
    message: Message;
    config: GuildConfig;
    action: string;
    reason: string;
    matched?: string;
}) {
    const { message, config, action, reason, matched } = options;
    const channel = resolveLogChannel(message, config);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle(`Moderation: ${action}`)
        .setColor(0xff6b6b)
        .addFields(
            { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
            { name: 'Channel', value: `<#${message.channel.id}>`, inline: true }
        )
        .setTimestamp(new Date());

    if (matched) {
        embed.addFields({ name: 'Matched', value: matched, inline: false });
    }

    if (message.content) {
        const content = message.content.length > 1000 ? `${message.content.slice(0, 1000)}...` : message.content;
        embed.addFields({ name: 'Content', value: content });
    }

    embed.addFields({ name: 'Reason', value: reason });

    try {
        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Failed to write to mod log channel:', error);
    }
}
