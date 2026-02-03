import { BaseCommand } from '../../structures/Command.ts';
import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import PollModel from '../../database/models/Poll.ts';
import PollDraftModel from '../../database/models/PollDraft.ts';
import { buildPollComponents, buildPollEmbed } from '../../services/polls.ts';
import { buildPollBuilderMessage } from '../../services/pollBuilder.ts';

export default class PollCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('poll')
                .setDescription('Create and manage polls')
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
                .addSubcommand((sub) =>
                    sub
                        .setName('create')
                        .setDescription('Open the poll builder')
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('close')
                        .setDescription('Close a poll by message ID')
                        .addStringOption((opt) =>
                            opt
                                .setName('message_id')
                                .setDescription('Poll message ID')
                                .setRequired(false)
                                .setAutocomplete(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('results')
                        .setDescription('Show poll results by message ID')
                        .addStringOption((opt) =>
                            opt
                                .setName('message_id')
                                .setDescription('Poll message ID')
                                .setRequired(false)
                                .setAutocomplete(true)
                        )
                )
        );
    }

    public override async execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            return;
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'create') {
            const draft = await PollDraftModel.create({
                guildId: interaction.guildId,
                channelId: interaction.channelId,
                createdBy: interaction.user.id,
                question: '',
                options: [],
                durationMinutes: null,
            });
            const builder = buildPollBuilderMessage(draft);
            await interaction.reply({ ...builder, flags: MessageFlags.Ephemeral });
            return;
        }

        if (sub === 'close') {
            const messageId = interaction.options.getString('message_id') ?? undefined;
            const poll = messageId
                ? await PollModel.findOne({ guildId: interaction.guildId, messageId })
                : await PollModel.findOne({ guildId: interaction.guildId, channelId: interaction.channelId })
                      .sort({ createdAt: -1 });

            if (!poll) {
                await interaction.reply({ content: 'Poll not found.', flags: MessageFlags.Ephemeral });
                return;
            }

            poll.isClosed = true;
            await poll.save();

            const embed = buildPollEmbed(poll);
            const components = buildPollComponents(poll);

            try {
                const channel = await interaction.guild?.channels.fetch(poll.channelId);
                if (channel && channel.isTextBased()) {
                    const message = await channel.messages.fetch(poll.messageId);
                    await message.edit({ embeds: [embed], components });
                }
            } catch {
                // Ignore if message not found
            }

            await interaction.reply({ content: 'Poll closed.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (sub === 'results') {
            const messageId = interaction.options.getString('message_id') ?? undefined;
            const poll = messageId
                ? await PollModel.findOne({ guildId: interaction.guildId, messageId })
                : await PollModel.findOne({ guildId: interaction.guildId, channelId: interaction.channelId })
                      .sort({ createdAt: -1 });

            if (!poll) {
                await interaction.reply({ content: 'Poll not found.', flags: MessageFlags.Ephemeral });
                return;
            }

            const embed = buildPollEmbed(poll);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    }
}
