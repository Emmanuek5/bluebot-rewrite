import { BaseCommand } from '../../structures/Command.ts';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, ChannelType } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import { ensureGuildConfig } from '../../database/guildConfig.ts';

export default class AIConfigCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('ai')
                .setDescription('Configure AI features')
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
                .addSubcommand((sub) =>
                    sub
                        .setName('enable')
                        .setDescription('Enable AI features for this server')
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('disable')
                        .setDescription('Disable AI features for this server')
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('model')
                        .setDescription('Set the AI model')
                        .addStringOption((opt) =>
                            opt
                                .setName('model')
                                .setDescription('OpenRouter model ID (e.g. openai/gpt-4o-mini)')
                                .setRequired(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('prompt')
                        .setDescription('Set the system prompt')
                        .addStringOption((opt) =>
                            opt.setName('prompt').setDescription('System prompt for the AI').setRequired(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('channel')
                        .setDescription('Restrict AI to specific channels')
                        .addChannelOption((opt) =>
                            opt
                                .setName('channel')
                                .setDescription('Channel to add/remove')
                                .addChannelTypes(ChannelType.GuildText)
                                .setRequired(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('maxtokens')
                        .setDescription('Set max response tokens')
                        .addIntegerOption((opt) =>
                            opt
                                .setName('tokens')
                                .setDescription('Max tokens (128-4096)')
                                .setMinValue(128)
                                .setMaxValue(4096)
                                .setRequired(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('settings')
                        .setDescription('View current AI settings')
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

        if (sub === 'enable') {
            if (!config.ai) (config as any).ai = {};
            config.ai!.enabled = true;
            await config.save();
            await interaction.reply({ content: 'AI features enabled. Members can now use `/ask`.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (sub === 'disable') {
            if (!config.ai) (config as any).ai = {};
            config.ai!.enabled = false;
            await config.save();
            await interaction.reply({ content: 'AI features disabled.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (sub === 'model') {
            const model = interaction.options.getString('model', true);
            if (!config.ai) (config as any).ai = {};
            config.ai!.model = model;
            await config.save();
            await interaction.reply({ content: `AI model set to \`${model}\`.`, flags: MessageFlags.Ephemeral });
            return;
        }

        if (sub === 'prompt') {
            const prompt = interaction.options.getString('prompt', true);
            if (!config.ai) (config as any).ai = {};
            config.ai!.systemPrompt = prompt;
            await config.save();
            await interaction.reply({
                content: `System prompt updated:\n\`\`\`\n${prompt.slice(0, 1800)}\n\`\`\``,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (sub === 'channel') {
            const channel = interaction.options.getChannel('channel', true);
            if (!config.ai) (config as any).ai = {};
            if (!config.ai!.allowedChannelIds) config.ai!.allowedChannelIds = [];

            const idx = config.ai!.allowedChannelIds.indexOf(channel.id);
            if (idx === -1) {
                config.ai!.allowedChannelIds.push(channel.id);
                await config.save();
                await interaction.reply({ content: `${channel} added to AI-allowed channels.`, flags: MessageFlags.Ephemeral });
            } else {
                config.ai!.allowedChannelIds.splice(idx, 1);
                await config.save();
                await interaction.reply({ content: `${channel} removed from AI-allowed channels.`, flags: MessageFlags.Ephemeral });
            }
            return;
        }

        if (sub === 'maxtokens') {
            const tokens = interaction.options.getInteger('tokens', true);
            if (!config.ai) (config as any).ai = {};
            config.ai!.maxTokens = tokens;
            await config.save();
            await interaction.reply({ content: `Max response tokens set to ${tokens}.`, flags: MessageFlags.Ephemeral });
            return;
        }

        if (sub === 'settings') {
            const ai = config.ai;
            const channels = ai?.allowedChannelIds?.length
                ? ai.allowedChannelIds.map((id) => `<#${id}>`).join(', ')
                : 'All channels';

            const embed = new EmbedBuilder()
                .setTitle('AI Settings')
                .setColor(0x5865f2)
                .addFields(
                    { name: 'Enabled', value: ai?.enabled ? 'Yes' : 'No', inline: true },
                    { name: 'Model', value: `\`${ai?.model ?? 'openai/gpt-4o-mini'}\``, inline: true },
                    { name: 'Max Tokens', value: `${ai?.maxTokens ?? 1024}`, inline: true },
                    { name: 'Allowed Channels', value: channels },
                    { name: 'System Prompt', value: `\`\`\`\n${(ai?.systemPrompt ?? 'Default').slice(0, 900)}\n\`\`\`` }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    }
}
