import { BaseInteraction } from '../../structures/Interaction.ts';
import type { ButtonInteraction, Client, ModalSubmitInteraction } from 'discord.js';
import {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import PollDraftModel from '../../database/models/PollDraft.ts';
import PollModel from '../../database/models/Poll.ts';
import { buildPollBuilderMessage } from '../../services/pollBuilder.ts';
import { buildPollComponents, buildPollEmbed } from '../../services/polls.ts';
import { MessageFlags } from 'discord.js';

function parseOptions(input: string) {
    return input
        .split(/[\n|]/g)
        .map((item) => item.trim())
        .filter(Boolean);
}

function extractDraftId(customId: string) {
    const parts = customId.split(':');
    return parts[3];
}

export default class PollBuilderInteraction extends BaseInteraction {
    constructor() {
        super('poll:builder', 'button');
    }

    public override async execute(
        interaction: ButtonInteraction | ModalSubmitInteraction,
        client: Client
    ): Promise<void> {
        if (!interaction.inGuild()) return;

        const action = interaction.customId.split(':')[2];
        const draftId = extractDraftId(interaction.customId);
        if (!draftId) return;

        const draft = await PollDraftModel.findById(draftId);
        if (!draft) {
            await interaction.reply({ content: 'Poll builder expired.', flags: MessageFlags.Ephemeral });
            return;
        }
        if (draft.createdBy !== interaction.user.id) {
            await interaction.reply({ content: 'Only the creator can edit this builder.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (interaction.isModalSubmit()) {
            const action = interaction.customId.split(':')[2];
            if (action === 'question') {
                draft.question = interaction.fields.getTextInputValue('question');
            } else if (action === 'options') {
                const raw = interaction.fields.getTextInputValue('options');
                draft.options = parseOptions(raw);
            } else if (action === 'duration') {
                const raw = interaction.fields.getTextInputValue('duration').trim();
                if (!raw) {
                    draft.durationMinutes = null;
                } else {
                    const minutes = Number.parseInt(raw, 10);
                    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
                        await interaction.reply({
                            content: 'Duration must be between 1 and 1440 minutes.',
                            flags: MessageFlags.Ephemeral,
                        });
                        return;
                    }
                    draft.durationMinutes = minutes;
                }
            }

            await draft.save();
            await interaction.update(buildPollBuilderMessage(draft));
            return;
        }

        if (action === 'setQuestion') {
            const modal = new ModalBuilder()
                .setCustomId(`poll:builder:question:${draft._id}`)
                .setTitle('Set Poll Question');
            const input = new TextInputBuilder()
                .setCustomId('question')
                .setLabel('Question')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue(draft.question ?? '');
            const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
            modal.addComponents(row);
            await interaction.showModal(modal);
            return;
        }

        if (action === 'setOptions') {
            const modal = new ModalBuilder()
                .setCustomId(`poll:builder:options:${draft._id}`)
                .setTitle('Set Poll Options');
            const input = new TextInputBuilder()
                .setCustomId('options')
                .setLabel('Options (one per line)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setValue(draft.options?.join('\n') ?? '');
            const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
            modal.addComponents(row);
            await interaction.showModal(modal);
            return;
        }

        if (action === 'setDuration') {
            const modal = new ModalBuilder()
                .setCustomId(`poll:builder:duration:${draft._id}`)
                .setTitle('Set Poll Duration');
            const input = new TextInputBuilder()
                .setCustomId('duration')
                .setLabel('Minutes (leave blank for no auto close)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue(draft.durationMinutes?.toString() ?? '');
            const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
            modal.addComponents(row);
            await interaction.showModal(modal);
            return;
        }

        if (action === 'publish') {
            if (!draft.question || draft.options.length < 2) {
                await interaction.reply({
                    content: 'Please set a question and at least 2 options.',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            if (draft.options.length > 10) {
                await interaction.reply({
                    content: 'Polls can have a maximum of 10 options.',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const endsAt =
                draft.durationMinutes && draft.durationMinutes > 0
                    ? new Date(Date.now() + draft.durationMinutes * 60_000)
                    : null;

            const poll = await PollModel.create({
                guildId: draft.guildId,
                channelId: draft.channelId,
                messageId: 'pending',
                question: draft.question,
                options: draft.options.map((label, index) => ({
                    optionId: `opt_${index + 1}`,
                    label,
                    votes: [],
                })),
                createdBy: draft.createdBy,
                endsAt,
                isClosed: false,
            });

            const embed = buildPollEmbed(poll);
            const components = buildPollComponents(poll);
            const channel = interaction.channel;

            if (!channel || !channel.isTextBased()) {
                await interaction.reply({ content: 'Channel not found.', flags: MessageFlags.Ephemeral });
                return;
            }

            const message = await channel.send({ embeds: [embed], components });
            poll.messageId = message.id;
            await poll.save();
            await PollDraftModel.deleteOne({ _id: draft._id });

            await interaction.update({
                content: 'Poll published.',
                embeds: [],
                components: [],
            });
            return;
        }

        if (action === 'cancel') {
            await PollDraftModel.deleteOne({ _id: draft._id });
            await interaction.update({
                content: 'Poll builder cancelled.',
                embeds: [],
                components: [],
            });
        }
    }
}
