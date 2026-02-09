import { BaseCommand } from '../../structures/Command.ts';
import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client, TextBasedChannel } from 'discord.js';
import ReactionRolePanelModel from '../../database/models/ReactionRolePanel.ts';
import ReactionRoleDraftModel from '../../database/models/ReactionRoleDraft.ts';
import { buildReactionRoleBuilderMessage } from '../../services/reactionRoleBuilder.ts';

async function resolveChannel(interaction: ChatInputCommandInteraction, channelId: string): Promise<TextBasedChannel | null> {
    const channel = await interaction.guild?.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return null;
    return channel;
}
export default class ReactionRolesCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('reactionroles')
                .setDescription('Create and manage reaction role panels')
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
                .addSubcommand((sub) =>
                    sub
                        .setName('create')
                        .setDescription('Open the reaction roles builder')
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('edit')
                        .setDescription('Edit a reaction role panel')
                        .addStringOption((opt) =>
                            opt
                                .setName('panel_id')
                                .setDescription('Panel ID')
                                .setRequired(true)
                                .setAutocomplete(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('delete')
                        .setDescription('Delete a reaction role panel')
                        .addStringOption((opt) =>
                            opt.setName('panel_id').setDescription('Panel ID').setRequired(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub.setName('list').setDescription('List reaction role panels')
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
            const draft = await ReactionRoleDraftModel.create({
                guildId: interaction.guildId,
                channelId: interaction.channelId,
                createdBy: interaction.user.id,
                title: '',
                description: '',
                items: [],
                panelId: null,
            });

            const builder = buildReactionRoleBuilderMessage(draft);
            await interaction.reply({ ...builder, flags: MessageFlags.Ephemeral });
            return;
        }

        if (sub === 'edit') {
            const panelId = interaction.options.getString('panel_id', true);
            const panel = await ReactionRolePanelModel.findById(panelId);

            if (!panel) {
                await interaction.reply({ content: 'Panel not found.', flags: MessageFlags.Ephemeral });
                return;
            }

            const draft = await ReactionRoleDraftModel.create({
                guildId: interaction.guildId,
                channelId: panel.channelId,
                createdBy: interaction.user.id,
                title: panel.title,
                description: panel.description ?? '',
                items: panel.items.map((item) => ({
                    roleId: item.roleId,
                    label: item.label,
                    emoji: item.emoji ?? null,
                })),
                panelId: panel.id,
            });

            const builder = buildReactionRoleBuilderMessage(draft);
            await interaction.reply({ ...builder, flags: MessageFlags.Ephemeral });
            return;
        }

        if (sub === 'delete') {
            const panelId = interaction.options.getString('panel_id', true);
            const panel = await ReactionRolePanelModel.findById(panelId);
            if (!panel) {
            await interaction.reply({ content: 'Panel not found.', flags: MessageFlags.Ephemeral });
            return;
        }

            panel.isActive = false;
            await panel.save();

            const channel = await resolveChannel(interaction, panel.channelId);
            if (channel) {
                try {
                    const message = await channel.messages.fetch(panel.messageId);
                    await message.delete();
                } catch {
                    // ignore
                }
            }

            await ReactionRolePanelModel.deleteOne({ _id: panelId });
            await interaction.reply({ content: 'Panel deleted.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (sub === 'list') {
            const panels = await ReactionRolePanelModel.find({ guildId: interaction.guildId })
                .sort({ createdAt: -1 })
                .limit(10);

            if (!panels.length) {
                await interaction.reply({ content: 'No panels found.', flags: MessageFlags.Ephemeral });
                return;
            }

            const lines = panels.map(
                (panel) =>
                    `- ${panel.id} - ${panel.title} (${panel.items.length} roles) <#${panel.channelId}>`
            );

            await interaction.reply({
                content: `Reaction role panels:\n${lines.join('\n')}`,
                flags: MessageFlags.Ephemeral,
            });
        }
    }
}
