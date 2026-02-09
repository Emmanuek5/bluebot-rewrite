import { EmbedBuilder, type Guild, type Message, type TextBasedChannel } from 'discord.js';
import type { HydratedDocument } from 'mongoose';
import type { GuildConfig } from '../database/models/GuildConfig.ts';
import ModerationCaseModel, { getNextCaseNumber } from '../database/models/ModerationCase.ts';

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

function resolveLogChannelFromMessage(message: Message, config: HydratedDocument<GuildConfig> | GuildConfig): TextBasedChannel | null {
    const channelId = (config as any).logging?.modLogChannelId;
    if (!channelId || !message.guild) return null;
    const channel = message.guild.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) return null;
    return channel;
}

function resolveLogChannelFromGuild(guild: Guild, config: HydratedDocument<GuildConfig> | GuildConfig): TextBasedChannel | null {
    const channelId = (config as any).logging?.modLogChannelId;
    if (!channelId) return null;
    const channel = guild.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) return null;
    return channel;
}

/**
 * Log an automod action (triggered by messageCreate). Creates a case and sends to log channel.
 */
export async function logModerationAction(options: {
    message: Message;
    config: HydratedDocument<GuildConfig> | GuildConfig;
    action: string;
    reason: string;
    matched?: string;
}) {
    const { message, config, action, reason, matched } = options;

    const caseNumber = await getNextCaseNumber(message.guild!.id);
    const modCase = await ModerationCaseModel.create({
        guildId: message.guild!.id,
        caseNumber,
        action: 'automod',
        targetId: message.author.id,
        targetTag: message.author.tag,
        moderatorId: message.client.user!.id,
        moderatorTag: message.client.user!.tag,
        reason: `[${action}] ${reason}${matched ? ` (matched: ${matched})` : ''}`,
    });

    const channel = resolveLogChannelFromMessage(message, config);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle(`Case #${caseNumber} — Automod: ${action}`)
        .setColor(ACTION_COLORS.automod ?? 0xff6b6b)
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
        if (!('send' in channel)) return;
        const sent = await channel.send({ embeds: [embed] });
        modCase.logMessageId = sent.id;
        await modCase.save();
    } catch (error) {
        console.error('Failed to write to mod log channel:', error);
    }
}

/**
 * Log a command-based mod action (kick, ban, warn, etc). Creates a case and sends to log channel.
 * Returns the case number.
 */
export async function logCommandAction(options: {
    guild: Guild;
    config: HydratedDocument<GuildConfig> | GuildConfig;
    action: string;
    targetId: string;
    targetTag: string;
    moderatorId: string;
    moderatorTag: string;
    reason: string;
    duration?: number | null;
}): Promise<number> {
    const { guild, config, action, targetId, targetTag, moderatorId, moderatorTag, reason, duration } = options;

    const caseNumber = await getNextCaseNumber(guild.id);
    const modCase = await ModerationCaseModel.create({
        guildId: guild.id,
        caseNumber,
        action,
        targetId,
        targetTag,
        moderatorId,
        moderatorTag,
        reason,
        duration: duration ?? null,
    });

    const channel = resolveLogChannelFromGuild(guild, config);
    if (!channel) return caseNumber;

    const embed = new EmbedBuilder()
        .setTitle(`Case #${caseNumber} — ${action.toUpperCase()}`)
        .setColor(ACTION_COLORS[action] ?? 0x95a5a6 as number)
        .addFields(
            { name: 'Target', value: `${targetTag} (${targetId})`, inline: true },
            { name: 'Moderator', value: `${moderatorTag} (${moderatorId})`, inline: true },
            { name: 'Reason', value: reason }
        )
        .setTimestamp(new Date());

    if (duration) {
        const label = duration < 3600
            ? `${Math.floor(duration / 60)}m`
            : duration < 86400
                ? `${Math.floor(duration / 3600)}h`
                : `${Math.floor(duration / 86400)}d`;
        embed.addFields({ name: 'Duration', value: label, inline: true });
    }

    try {
        if (!('send' in channel)) return caseNumber;
        const sent = await channel.send({ embeds: [embed] });
        modCase.logMessageId = sent.id;
        await modCase.save();
    } catch (error) {
        console.error('Failed to write to mod log channel:', error);
    }

    return caseNumber;
}
