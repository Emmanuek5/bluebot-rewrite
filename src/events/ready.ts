import { BaseEvent } from '../structures/Event.ts';
import { Events, Client } from 'discord.js';
import { deployCommands } from '../deploy.ts';
import { startPollScheduler } from '../services/pollScheduler.ts';
import { startTempbanScheduler } from '../services/tempbanScheduler.ts';

export default class ReadyEvent extends BaseEvent<Events.ClientReady> {
    constructor() {
        super(Events.ClientReady, true);
    }

    public override async execute(client: Client, readyClient: Client<true>) {
        console.log(`Ready! Logged in as ${readyClient.user.tag}`);

        await deployCommands({
            token: process.env.DISCORD_TOKEN,
            clientId: readyClient.user.id,
            guildId: process.env.GUILD_ID,
        });

        startPollScheduler(client);
        startTempbanScheduler(client);
    }
}
