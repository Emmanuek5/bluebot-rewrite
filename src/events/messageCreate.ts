import { BaseEvent } from '../structures/Event.ts';
import { Events, PermissionFlagsBits } from 'discord.js';
import type { Client, Message } from 'discord.js';
import { ensureGuildConfig } from '../database/guildConfig.ts';
import type { HydratedDocument } from 'mongoose';
import type { GuildConfig } from '../database/models/GuildConfig.ts';
import { logModerationAction } from '../services/modLog.ts';
import { mergeSwearWords } from '../moderation/swearWords.ts';
import { DEFAULT_ESCALATION } from '../moderation/escalation.ts';
import { generateAIResponse, isAIConfigured } from '../services/ai.ts';

const WARNING_TTL_MS = 10_000;
const DEFAULT_STICKY_INTERVAL = 5;
const stickyCounters = new Map<string, number>();
const violationCounters = new Map<string, number[]>();


function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeList(list: string[] | undefined) {
    if (!list) return [];
    return list.map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function findWordMatch(content: string, words: string[]) {
    const normalized = normalizeList(words);
    if (!normalized.length) return null;

    for (const word of normalized) {
        const pattern = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i');
        if (pattern.test(content)) return word;
    }

    return null;
}

function findRegexMatch(content: string, patterns: string[]) {
    const normalized = normalizeList(patterns);
    if (!normalized.length) return null;

    for (const pattern of normalized) {
        try {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(content)) return pattern;
        } catch {
            // Ignore invalid regex patterns
        }
    }

    return null;
}

function isCapsAbuse(content: string, ratio: number, minLength: number) {
    const letters = content.match(/[a-z]/gi);
    if (!letters || letters.length < minLength) return false;
    const caps = letters.filter((char) => char === char.toUpperCase()).length;
    return caps / letters.length >= ratio;
}

async function warnUser(message: Message, reason: string) {
    try {
        const channel = message.channel;
        if (!('send' in channel)) return;
        const warning = await channel.send({
            content: `${message.author}, ${reason}`,
        });
        setTimeout(() => warning.delete().catch(() => {}), WARNING_TTL_MS);
    } catch (error) {
        console.error('Failed to send warning message:', error);
    }
}

function getEscalation(config: HydratedDocument<GuildConfig>) {
    const escalation = config.moderation?.escalation;
    return {
        enabled: escalation?.enabled ?? DEFAULT_ESCALATION.enabled,
        maxViolations: escalation?.maxViolations ?? DEFAULT_ESCALATION.maxViolations,
        windowMinutes: escalation?.windowMinutes ?? DEFAULT_ESCALATION.windowMinutes,
        timeoutMinutes: escalation?.timeoutMinutes ?? DEFAULT_ESCALATION.timeoutMinutes,
    };
}

async function handleEscalation(message: Message, config: HydratedDocument<GuildConfig>, reason: string) {
    const escalation = getEscalation(config);
    if (!escalation.enabled) return;

    const windowMs = escalation.windowMinutes * 60_000;
    const now = Date.now();
    const key = `${message.guildId}:${message.author.id}`;

    const list = (violationCounters.get(key) ?? []).filter((t) => now - t <= windowMs);
    list.push(now);
    violationCounters.set(key, list);

    if (list.length < escalation.maxViolations) return;
    violationCounters.set(key, []);

    const member =
        message.member ??
        (message.guild ? await message.guild.members.fetch(message.author.id).catch(() => null) : null);

    if (!member) return;
    if (!member.moderatable) return;
    if (member.communicationDisabledUntilTimestamp && member.communicationDisabledUntilTimestamp > now) return;

    const timeoutMs = escalation.timeoutMinutes * 60_000;

    try {
        await member.timeout(timeoutMs, `Auto timeout: ${reason}`);
        await warnUser(
            message,
            `you have been timed out for ${escalation.timeoutMinutes} minutes due to repeated violations.`
        );
        await logModerationAction({
            message,
            config,
            action: 'Auto Timeout',
            reason: `Reached ${escalation.maxViolations} violations in ${escalation.windowMinutes} minutes`,
        });
    } catch (error) {
        console.error('Failed to timeout member:', error);
    }
}

async function handleSticky(message: Message, config: HydratedDocument<GuildConfig>) {
    if (!config?.stickyMessages?.length) return;
    const sticky = config.stickyMessages.find(
        (entry: any) => entry.channelId === message.channel.id && entry.enabled
    );
    if (!sticky) return;

    const interval = Number.isFinite(sticky.interval) && sticky.interval > 0
        ? sticky.interval
        : DEFAULT_STICKY_INTERVAL;
    const counterKey = `${message.guild?.id}:${message.channel.id}`;
    const nextCount = (stickyCounters.get(counterKey) ?? 0) + 1;
    if (nextCount < interval) {
        stickyCounters.set(counterKey, nextCount);
        return;
    }
    stickyCounters.set(counterKey, 0);

    if (sticky.lastMessageId) {
        try {
            const lastMessage = await message.channel.messages.fetch(sticky.lastMessageId);
            await lastMessage.delete();
        } catch {
            // Ignore if missing or cannot delete
        }
    }

    try {
        const ch = message.channel;
        if (!('send' in ch)) return;
        const sent = await ch.send({ content: sticky.content });
        sticky.lastMessageId = sent.id;
        if (!sticky.interval) {
            sticky.interval = interval;
        }
        await config.save();
    } catch (error) {
        console.error('Failed to update sticky message:', error);
    }
}

export default class MessageCreateEvent extends BaseEvent<Events.MessageCreate> {
    constructor() {
        super(Events.MessageCreate);
    }

    public override async execute(client: Client, message: Message) {
        if (!message.guild) return;
        if (message.author.bot) return;

        const config = await ensureGuildConfig(message.guild.id);

        // Skip ignored channels (still handle sticky)
        if (config.ignoredChannelIds?.includes(message.channel.id)) {
            await handleSticky(message, config);
            return;
        }

        const member = message.member;
        const bypassStaff = config.moderation?.bypassStaff ?? true;

        // Bypass via Manage Messages permission
        if (bypassStaff && member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
            await handleSticky(message, config);
            return;
        }

        // Bypass via configured mod role
        if (config.modRoleId && member?.roles.cache.has(config.modRoleId)) {
            await handleSticky(message, config);
            return;
        }

        const content = message.content ?? '';
        const moderation = config.moderation;

        let deleted = false;

        if (moderation?.bannedWords?.enabled) {
            const match = findWordMatch(content, moderation.bannedWords.words);
            if (match) {
                try {
                    await message.delete();
                    deleted = true;
                } catch (error) {
                    console.error('Failed to delete message for banned word:', error);
                }

                await warnUser(message, 'your message contained a banned word and was removed.');
                await logModerationAction({
                    message,
                    config,
                    action: 'Banned Word',
                    reason: 'Banned word detected',
                    matched: match,
                });
                await handleEscalation(message, config, 'Banned word');
            }
        }

        if (!deleted && moderation?.regexFilters?.enabled) {
            const match = findRegexMatch(content, moderation.regexFilters.patterns);
            if (match) {
                try {
                    await message.delete();
                    deleted = true;
                } catch (error) {
                    console.error('Failed to delete message for regex filter:', error);
                }

                await warnUser(message, 'your message matched a blocked pattern and was removed.');
                await logModerationAction({
                    message,
                    config,
                    action: 'Regex Filter',
                    reason: 'Blocked pattern detected',
                    matched: match,
                });
                await handleEscalation(message, config, 'Regex filter');
            }
        }

        if (!deleted && moderation?.caps?.enabled) {
            if (isCapsAbuse(content, moderation.caps.ratio, moderation.caps.minLength)) {
                await warnUser(message, 'please avoid excessive caps.');
                await logModerationAction({
                    message,
                    config,
                    action: 'Caps',
                    reason: 'Caps threshold exceeded',
                });
            }
        }

        if (!deleted && moderation?.mentions?.enabled) {
            const mentionCount =
                message.mentions.users.size +
                message.mentions.roles.size +
                (message.mentions.everyone ? 1 : 0);

            if (mentionCount > moderation.mentions.max) {
                await warnUser(message, 'please avoid excessive mentions.');
                await logModerationAction({
                    message,
                    config,
                    action: 'Mentions',
                    reason: `Mentions exceeded (${mentionCount}/${moderation.mentions.max})`,
                });
            }
        }

        if (!deleted && moderation?.swears?.enabled) {
            const match = findWordMatch(content, mergeSwearWords(moderation.swears.words));
            if (match) {
                await logModerationAction({
                    message,
                    config,
                    action: 'Swear Monitor',
                    reason: 'Swear word detected',
                    matched: match,
                });
                await handleEscalation(message, config, 'Swear word');
            }
        }

        await handleSticky(message, config);
        await handleAutoResponder(message, config);
    }
}

async function handleAutoResponder(message: Message, config: HydratedDocument<GuildConfig>) {
    if (!isAIConfigured()) return;
    if (!config.autoResponders?.length) return;

    const content = message.content.toLowerCase();

    for (const trigger of config.autoResponders as any[]) {
        if (!content.includes(trigger.keyword.toLowerCase())) continue;

        // Check channel restriction
        if (trigger.channelIds?.length && !trigger.channelIds.includes(message.channel.id)) continue;

        try {
            const ch = message.channel;
            if (!('send' in ch)) return;

            if (trigger.useAI) {
                const aiResponse = await generateAIResponse({
                    model: config.ai?.model ?? 'openai/gpt-4o-mini',
                    systemPrompt: `You are a helpful assistant in a Discord server. Answer the user's question using the following context as your knowledge base. Be concise and helpful.\n\nContext:\n${trigger.response}`,
                    userMessage: message.content,
                    maxTokens: config.ai?.maxTokens ?? 1024,
                });

                if (aiResponse) {
                    const reply = aiResponse.length > 2000 ? aiResponse.slice(0, 1997) + '...' : aiResponse;
                    await ch.send({ content: reply, reply: { messageReference: message.id } });
                }
            } else {
                await ch.send({ content: trigger.response, reply: { messageReference: message.id } });
            }

            break;
        } catch (error) {
            console.error('Auto-responder error:', error);
        }
    }
}
