import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';
import type { PollDraft } from '../database/models/PollDraft.ts';

function statusLine(label: string, ok: boolean, value?: string) {
    const icon = ok ? '✅' : '⚠️';
    return `${icon} ${label}${value ? `: ${value}` : ''}`;
}

export function buildPollBuilderMessage(draft: PollDraft) {
    const hasQuestion = Boolean(draft.question?.trim());
    const hasOptions = (draft.options?.length ?? 0) >= 2;
    const duration =
        draft.durationMinutes && draft.durationMinutes > 0
            ? `${draft.durationMinutes} min`
            : 'No auto close';

    const embed = new EmbedBuilder()
        .setTitle('Poll Builder')
        .setDescription(
            [
                statusLine('Question', hasQuestion, hasQuestion ? draft.question : 'Not set'),
                statusLine('Options', hasOptions, `${draft.options?.length ?? 0} set`),
                statusLine('Duration', true, duration),
            ].join('\n')
        )
        .setFooter({ text: 'Use the buttons below to configure your poll.' });

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`poll:builder:setQuestion:${draft._id}`)
            .setLabel('Set Question')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`poll:builder:setOptions:${draft._id}`)
            .setLabel('Set Options')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`poll:builder:setDuration:${draft._id}`)
            .setLabel('Set Duration')
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`poll:builder:publish:${draft._id}`)
            .setLabel('Publish')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!hasQuestion || !hasOptions),
        new ButtonBuilder()
            .setCustomId(`poll:builder:cancel:${draft._id}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
    );

    return {
        embeds: [embed],
        components: [row1, row2],
        flags: MessageFlags.Ephemeral,
    };
}
