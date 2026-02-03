import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
} from 'discord.js';
import type { ReactionRolePanel } from '../database/models/ReactionRolePanel.ts';

function clampLabel(label: string, max = 80) {
    if (label.length <= max) return label;
    return `${label.slice(0, max - 3)}...`;
}

export function buildReactionRoleEmbed(panel: ReactionRolePanel) {
    const lines = panel.items.map((item) => {
        const emoji = item.emoji ? `${item.emoji} ` : '';
        return `${emoji}<@&${item.roleId}>`;
    });

    return new EmbedBuilder()
        .setTitle(panel.title)
        .setDescription([panel.description, lines.join('\n')].filter(Boolean).join('\n\n'))
        .setFooter({ text: panel.isActive ? 'Select roles below' : 'Panel disabled' });
}

export function buildReactionRoleComponents(panel: ReactionRolePanel) {
    if (!panel.isActive) {
        return [];
    }

    if (panel.items.length <= 5) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        for (const item of panel.items) {
            const button = new ButtonBuilder()
                .setCustomId(`reactionroles:${panel._id}:${item.roleId}`)
                .setLabel(clampLabel(item.label))
                .setStyle(ButtonStyle.Secondary);
            if (item.emoji) {
                button.setEmoji(item.emoji);
            }
            row.addComponents(button);
        }
        return [row];
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId(`reactionroles:${panel._id}`)
        .setPlaceholder('Select roles')
        .setMinValues(0)
        .setMaxValues(Math.min(10, panel.items.length))
        .addOptions(
            panel.items.map((item) => ({
                label: clampLabel(item.label),
                value: item.roleId,
                emoji: item.emoji ?? undefined,
            }))
        );

    return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)];
}
