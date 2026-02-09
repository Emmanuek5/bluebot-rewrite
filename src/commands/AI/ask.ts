import { BaseCommand } from '../../structures/Command.ts';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import { ensureGuildConfig } from '../../database/guildConfig.ts';
import { generateAIResponse, isAIConfigured } from '../../services/ai.ts';

export default class AskCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('ask')
                .setDescription('Ask the AI a question')
                .addStringOption((opt) =>
                    opt.setName('question').setDescription('Your question').setRequired(true)
                )
                .addBooleanOption((opt) =>
                    opt.setName('ephemeral').setDescription('Only visible to you (default: false)').setRequired(false)
                )
        );
    }

    public override async execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
        if (!isAIConfigured()) {
            await interaction.reply({ content: 'AI features are not configured. The bot owner needs to set `OPENROUTER_API_KEY`.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            return;
        }

        const config = await ensureGuildConfig(interaction.guildId);

        if (!config.ai?.enabled) {
            await interaction.reply({ content: 'AI features are not enabled for this server. An admin can enable them with `/ai enable`.', flags: MessageFlags.Ephemeral });
            return;
        }

        // Check if command is restricted to specific channels
        const allowedChannels = config.ai.allowedChannelIds ?? [];
        if (allowedChannels.length > 0 && !allowedChannels.includes(interaction.channelId)) {
            await interaction.reply({
                content: `AI commands are restricted to: ${allowedChannels.map((id) => `<#${id}>`).join(', ')}`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const question = interaction.options.getString('question', true);
        const ephemeral = interaction.options.getBoolean('ephemeral') ?? false;

        await interaction.deferReply({ flags: ephemeral ? MessageFlags.Ephemeral : undefined });

        try {
            const response = await generateAIResponse({
                model: config.ai.model ?? 'openai/gpt-4o-mini',
                systemPrompt: config.ai.systemPrompt ?? 'You are a helpful Discord bot assistant. Be concise and friendly.',
                userMessage: question,
                maxTokens: config.ai.maxTokens ?? 1024,
            });

            // Discord has a 2000 char limit for messages, 4096 for embed descriptions
            if (response.length <= 4096) {
                const embed = new EmbedBuilder()
                    .setDescription(response)
                    .setColor(0x5865f2)
                    .setFooter({ text: `Model: ${config.ai.model ?? 'openai/gpt-4o-mini'} • Asked by ${interaction.user.tag}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } else {
                // Split into chunks for very long responses
                const chunks = response.match(/[\s\S]{1,1990}/g) ?? [response];
                await interaction.editReply({ content: chunks[0] });
                for (let i = 1; i < Math.min(chunks.length, 5); i++) {
                    await interaction.followUp({ content: chunks[i], flags: ephemeral ? MessageFlags.Ephemeral : undefined });
                }
            }
        } catch (error) {
            console.error('AI generation error:', error);
            await interaction.editReply({ content: 'Failed to generate a response. Please try again later.' });
        }
    }
}
