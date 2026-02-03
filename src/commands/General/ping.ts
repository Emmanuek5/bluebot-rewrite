import { BaseCommand } from '../../structures/Command.ts';
import { ComponentHelper } from '../../structures/Component.ts';
import { SlashCommandBuilder, ChatInputCommandInteraction, Client, ButtonStyle } from 'discord.js';

export default class PingCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('ping')
                .setDescription('Replies with Pong and latency statistics!')
        );
    }

    public override async execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
        const sent = await interaction.reply({ 
            content: 'Pinging...', 
            withResponse: true,
            components: [] 
        });

        const latency = sent.resource?.message?.createdTimestamp ? sent.resource.message.createdTimestamp - interaction.createdTimestamp : 0;
        const apiLatency = Math.round(client.ws.ping);

        const refreshButton = ComponentHelper.button({
            customId: 'ping:refresh',
            label: 'Refresh',
            style: ButtonStyle.Primary,
            emoji: '🔄'
        });

        const row = ComponentHelper.row(refreshButton);

        await interaction.editReply({
            content: `🏓 Pong!\nLatency: **${latency}ms**\nAPI Latency: **${apiLatency}ms**`,
            components: [row]
        });
    }
}
