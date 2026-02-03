import { BaseInteraction } from '../../structures/Interaction.ts';
import type { AnySelectMenuInteraction, ButtonInteraction, Client, ModalSubmitInteraction } from 'discord.js';
import {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import ReactionRoleDraftModel from '../../database/models/ReactionRoleDraft.ts';
import ReactionRolePanelModel from '../../database/models/ReactionRolePanel.ts';
import { buildReactionRoleBuilderMessage } from '../../services/reactionRoleBuilder.ts';
import { buildReactionRoleComponents, buildReactionRoleEmbed } from '../../services/reactionRoles.ts';
import { MessageFlags } from 'discord.js';

function extractDraftId(customId: string) {
    const parts = customId.split(':');
    return parts[3];
}

function normalizeRoleId(input: string) {
    const match = input.match(/\d{17,20}/);
    return match ? match[0] : null;
}

function parseCustomLines(raw: string) {
    const lines = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    const entries = [];
    for (const line of lines) {
        const parts = line.split(':').map((p) => p.trim());
        const roleId = normalizeRoleId(parts[0] ?? '');
        if (!roleId) continue;
        const label = parts[1] ?? '';
        const emoji = parts[2] ?? null;
        entries.push({ roleId, label, emoji });
    }
    return entries;
}

export default class ReactionRolesBuilderInteraction extends BaseInteraction {
    constructor() {
        super('reactionroles:builder', 'button');
    }

    public override async execute(
        interaction: ButtonInteraction | ModalSubmitInteraction | AnySelectMenuInteraction,
        client: Client
    ): Promise<void> {
        if (!interaction.inGuild()) return;

        const draftId = extractDraftId(interaction.customId);
        if (!draftId) return;

        const draft = await ReactionRoleDraftModel.findById(draftId);
        if (!draft) {
            await interaction.reply({ content: 'Builder expired.', flags: MessageFlags.Ephemeral });
            return;
        }
        if (draft.createdBy !== interaction.user.id) {
            await interaction.reply({ content: 'Only the creator can edit this builder.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (interaction.isModalSubmit()) {
            const action = interaction.customId.split(':')[2];
            if (action === 'meta') {
                draft.title = interaction.fields.getTextInputValue('title');
                draft.description = interaction.fields.getTextInputValue('description');
            } else if (action === 'custom') {
                const raw = interaction.fields.getTextInputValue('lines');
                const entries = parseCustomLines(raw);
                for (const entry of entries) {
                    const item = draft.items.find((i) => i.roleId === entry.roleId);
                    if (!item) continue;
                    if (entry.label) item.label = entry.label;
                    if (entry.emoji !== null) item.emoji = entry.emoji || null;
                }
            }

            await draft.save();
            await interaction.update(buildReactionRoleBuilderMessage(draft));
            return;
        }

        if (interaction.isAnySelectMenu()) {
            const action = interaction.customId.split(':')[2];
            if (action !== 'roles') return;

            const selected = interaction.values;
            const items = [];

            for (const roleId of selected) {
                const role = interaction.guild?.roles.cache.get(roleId);
                if (!role) continue;
                const existing = draft.items.find((i) => i.roleId === roleId);
                items.push({
                    roleId,
                    label: existing?.label ?? role.name,
                    emoji: existing?.emoji ?? null,
                });
            }

            draft.items = items;
            await draft.save();
            await interaction.update(buildReactionRoleBuilderMessage(draft));
            return;
        }

        const action = interaction.customId.split(':')[2];
        if (action === 'setMeta') {
            const modal = new ModalBuilder()
                .setCustomId(`reactionroles:builder:meta:${draft._id}`)
                .setTitle('Set Panel Details');
            const titleInput = new TextInputBuilder()
                .setCustomId('title')
                .setLabel('Title')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue(draft.title ?? '');
            const descInput = new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Description')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setValue(draft.description ?? '');

            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(descInput)
            );
            await interaction.showModal(modal);
            return;
        }

        if (action === 'customize') {
            const modal = new ModalBuilder()
                .setCustomId(`reactionroles:builder:custom:${draft._id}`)
                .setTitle('Customize Labels/Emoji');
            const input = new TextInputBuilder()
                .setCustomId('lines')
                .setLabel('roleId:label:emoji (one per line)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setValue(
                    draft.items
                        .map((item) => `${item.roleId}:${item.label}${item.emoji ? `:${item.emoji}` : ''}`)
                        .join('\n')
                );
            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
            await interaction.showModal(modal);
            return;
        }

        if (action === 'publish') {
            if (!draft.title || !draft.items.length) {
                await interaction.reply({
                    content: 'Please set a title and select at least one role.',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            let panel;
            if (draft.panelId) {
                panel = await ReactionRolePanelModel.findById(draft.panelId);
            }

            if (!panel) {
                panel = await ReactionRolePanelModel.create({
                    guildId: draft.guildId,
                    channelId: draft.channelId,
                    messageId: 'pending',
                    title: draft.title,
                    description: draft.description ?? '',
                    items: draft.items,
                    createdBy: draft.createdBy,
                    isActive: true,
                });
            } else {
                panel.title = draft.title;
                panel.description = draft.description ?? '';
                panel.items = draft.items;
                await panel.save();
            }

            const channel = interaction.channel;
            if (!channel || !channel.isTextBased()) {
                await interaction.reply({ content: 'Channel not found.', flags: MessageFlags.Ephemeral });
                return;
            }

            const embeds = [buildReactionRoleEmbed(panel)];
            const components = buildReactionRoleComponents(panel);

            if (panel.messageId && panel.messageId !== 'pending') {
                try {
                    const message = await channel.messages.fetch(panel.messageId);
                    if (message.editable) {
                        await message.edit({ embeds, components });
                    } else {
                        await message.delete().catch(() => {});
                        const newMessage = await channel.send({ embeds, components });
                        panel.messageId = newMessage.id;
                        await panel.save();
                    }
                } catch {
                    const newMessage = await channel.send({ embeds, components });
                    panel.messageId = newMessage.id;
                    await panel.save();
                }
            } else {
                const newMessage = await channel.send({ embeds, components });
                panel.messageId = newMessage.id;
                await panel.save();
            }

            await ReactionRoleDraftModel.deleteOne({ _id: draft._id });

            await interaction.update({
                content: `Reaction roles panel ${draft.panelId ? 'updated' : 'published'}. ID: ${panel.id}`,
                embeds: [],
                components: [],
            });
            return;
        }

        if (action === 'cancel') {
            await ReactionRoleDraftModel.deleteOne({ _id: draft._id });
            await interaction.update({
                content: 'Builder cancelled.',
                embeds: [],
                components: [],
            });
        }
    }
}
