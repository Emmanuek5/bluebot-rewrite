import { BaseEvent } from '../structures/Event.ts';
import { Events } from 'discord.js';
import type { Client, Guild } from 'discord.js';
import { ensureGuildConfig } from '../database/guildConfig.ts';

export default class GuildCreateEvent extends BaseEvent<Events.GuildCreate> {
    constructor() {
        super(Events.GuildCreate);
    }

    public override async execute(client: Client, guild: Guild) {
        await ensureGuildConfig(guild.id);
        console.log(`Guild config created for ${guild.name} (${guild.id}).`);
    }
}
