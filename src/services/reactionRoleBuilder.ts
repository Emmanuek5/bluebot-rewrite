import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    RoleSelectMenuBuilder,
} from 'discord.js';
import type { ReactionRoleDraft } from '../database/models/ReactionRoleDraft.ts';

function statusLine(label: string, ok: boolean, value?: string) {
    const icon = ok ? '✅' : '⚠️';
    return `${icon} ${label}${value ? `: ${value}` : ''}`;
}

export function buildReactionRoleBuilderMessage(draft: ReactionRoleDraft) {
    const hasTitle = Boolean(draft.title?.trim());
    const hasRoles = (draft.items?.length ?? 0) > 0;

    const embed = new EmbedBuilder()
        .setTitle('Reaction Roles Builder')
        .setDescription(
            [
                statusLine('Title', hasTitle, hasTitle ? draft.title : 'Not set'),
                statusLine('Description', true, draft.description || 'None'),
                statusLine('Roles', hasRoles, `${draft.items?.length ?? 0} selected`),
            ].join('\n')
        )
        .setFooter({ text: 'Select roles below, then publish.' });

    const select = new RoleSelectMenuBuilder()
        .setCustomId(`reactionroles:builder:roles:${draft._id}`)
        .setPlaceholder('Select roles to include')
        .setMinValues(0)
        .setMaxValues(10);

    const row1 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(select);

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`reactionroles:builder:setMeta:${draft._id}`)
            .setLabel('Set Title/Description')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`reactionroles:builder:customize:${draft._id}`)
            .setLabel('Customize Labels/Emoji')
            .setStyle(ButtonStyle.Secondary)
    );

    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`reactionroles:builder:publish:${draft._id}`)
            .setLabel('Publish')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!hasTitle || !hasRoles),
        new ButtonBuilder()
            .setCustomId(`reactionroles:builder:cancel:${draft._id}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
    );

    return {
        embeds: [embed],
        components: [row1, row2, row3],
        flags: MessageFlags.Ephemeral,
    };
}
