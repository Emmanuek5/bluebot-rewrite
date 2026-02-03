import { BaseCommand } from '../../structures/Command.ts';
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import { ensureGuildConfig } from '../../database/guildConfig.ts';
import { buildSetupPanel } from '../../panels/setupPanel.ts';

export default class SetupCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('setup')
                .setDescription('Open the server setup panel')
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        );
    }

    public override async execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const config = await ensureGuildConfig(interaction.guildId);
        const panel = buildSetupPanel(
            'home',
            config,
            interaction.guild?.name ?? 'Server',
            interaction.channelId
        );

        await interaction.reply(panel);
    }
}
