import { BaseCommand } from '../../structures/Command.ts';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, ChannelType } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import { ensureGuildConfig } from '../../database/guildConfig.ts';

export default class AutoResponderCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('autoresponder')
                .setDescription('Manage AI auto-responder triggers')
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
                .addSubcommand((sub) =>
                    sub
                        .setName('add')
                        .setDescription('Add an auto-responder trigger')
                        .addStringOption((opt) =>
                            opt.setName('keyword').setDescription('Keyword or phrase to trigger on').setRequired(true)
                        )
                        .addStringOption((opt) =>
                            opt
                                .setName('response')
                                .setDescription('Response text or context for AI to use')
                                .setRequired(true)
                        )
                        .addBooleanOption((opt) =>
                            opt
                                .setName('use_ai')
                                .setDescription('Use AI to generate response based on context (default: true)')
                                .setRequired(false)
                        )
                        .addChannelOption((opt) =>
                            opt
                                .setName('channel')
                                .setDescription('Restrict to a specific channel (optional)')
                                .addChannelTypes(ChannelType.GuildText)
                                .setRequired(false)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('remove')
                        .setDescription('Remove an auto-responder trigger')
                        .addStringOption((opt) =>
                            opt.setName('id').setDescription('Trigger ID').setRequired(true).setAutocomplete(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('list')
                        .setDescription('List all auto-responder triggers')
                )
        );
    }

    public override async execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            return;
        }

        const config = await ensureGuildConfig(interaction.guildId);
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const keyword = interaction.options.getString('keyword', true).toLowerCase();
            const response = interaction.options.getString('response', true);
            const useAI = interaction.options.getBoolean('use_ai') ?? true;
            const channel = interaction.options.getChannel('channel');

            const existing = config.autoResponders.find((t) => t.keyword === keyword);
            if (existing) {
                await interaction.reply({ content: `A trigger for \`${keyword}\` already exists. Remove it first.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const trigger: any = { keyword, response, useAI };
            if (channel) trigger.channelIds = [channel.id];

            config.autoResponders.push(trigger);
            await config.save();

            const embed = new EmbedBuilder()
                .setTitle('Auto-Responder Added')
                .setColor(0x5865f2)
                .addFields(
                    { name: 'Keyword', value: `\`${keyword}\``, inline: true },
                    { name: 'AI Mode', value: useAI ? 'Yes — AI generates response using context' : 'No — sends response text directly', inline: true },
                    { name: 'Response/Context', value: response.slice(0, 1024) }
                )
                .setTimestamp();

            if (channel) {
                embed.addFields({ name: 'Restricted to', value: `${channel}`, inline: true });
            }

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        if (sub === 'remove') {
            const id = interaction.options.getString('id', true);
            const idx = config.autoResponders.findIndex((t: any) => t._id?.toString() === id);

            if (idx === -1) {
                await interaction.reply({ content: 'Trigger not found.', flags: MessageFlags.Ephemeral });
                return;
            }

            const removed = config.autoResponders[idx]!;
            config.autoResponders.splice(idx, 1);
            await config.save();

            await interaction.reply({
                content: `Removed auto-responder for \`${removed.keyword}\`.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (sub === 'list') {
            if (!config.autoResponders.length) {
                await interaction.reply({ content: 'No auto-responder triggers configured.', flags: MessageFlags.Ephemeral });
                return;
            }

            const lines = config.autoResponders.map((t: any) => {
                const channels = t.channelIds?.length ? t.channelIds.map((id: string) => `<#${id}>`).join(', ') : 'All';
                return `\`${t._id}\` — **${t.keyword}** (AI: ${t.useAI ? 'Yes' : 'No'}) — Channels: ${channels}`;
            });

            const embed = new EmbedBuilder()
                .setTitle('Auto-Responder Triggers')
                .setColor(0x5865f2)
                .setDescription(lines.join('\n'))
                .setFooter({ text: `${config.autoResponders.length} trigger(s)` });

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    }
}
