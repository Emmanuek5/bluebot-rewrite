import { BaseEvent } from '../structures/Event.ts';
import { Events } from 'discord.js';
import type { Client, GuildMember } from 'discord.js';
import { ensureGuildConfig } from '../database/guildConfig.ts';

export default class GuildMemberAddEvent extends BaseEvent<Events.GuildMemberAdd> {
    constructor() {
        super(Events.GuildMemberAdd);
    }

    public override async execute(client: Client, member: GuildMember) {
        const config = await ensureGuildConfig(member.guild.id);
        if (!config?.autoRoles?.enabled) return;
        if (!config.autoRoles.roleIds?.length) return;

        try {
            await member.roles.add(config.autoRoles.roleIds);
        } catch (error) {
            console.error('Failed to assign auto roles:', error);
        }
    }
}
