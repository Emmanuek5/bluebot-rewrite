import { BaseInteraction } from '../../structures/Interaction.ts';
import { ComponentHelper } from '../../structures/Component.ts';
import { ButtonInteraction, Client, ButtonStyle } from 'discord.js';

export default class PingRefreshInteraction extends BaseInteraction {
    constructor() {
        super('ping:refresh', 'button');
    }

    public override async execute(interaction: ButtonInteraction, client: Client): Promise<void> {
        // Defer update to stop the loading state on the button
        await interaction.deferUpdate();

        const start = Date.now();
        // We simulate a fetch/calculation
        const apiLatency = Math.round(client.ws.ping);
        const processing = Date.now() - start;

        const refreshButton = ComponentHelper.button({
            customId: 'ping:refresh',
            label: 'Refresh',
            style: ButtonStyle.Primary,
            emoji: '🔄'
        });

        const row = ComponentHelper.row(refreshButton);

        await interaction.editReply({
            content: `🏓 Pong! (Refreshed)\nProcessing: **${processing}ms**\nAPI Latency: **${apiLatency}ms**\nLast Update: <t:${Math.floor(Date.now() / 1000)}:R>`,
            components: [row]
        });
    }
}
