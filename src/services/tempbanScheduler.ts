import type { Client } from 'discord.js';
import TempbanModel from '../database/models/Tempban.ts';

const TEMPBAN_SWEEP_MS = 60_000;

async function processExpiredBan(client: Client, tempban: any) {
    try {
        const guild = client.guilds.cache.get(tempban.guildId);
        if (!guild) return;

        await guild.members.unban(tempban.userId, 'Tempban expired');
        await tempban.deleteOne();
    } catch {
        // User may already be unbanned or guild unavailable — clean up anyway
        await tempban.deleteOne();
    }
}

export function startTempbanScheduler(client: Client) {
    setInterval(async () => {
        const now = new Date();
        const expired = await TempbanModel.find({
            expiresAt: { $lte: now },
        }).limit(25);

        for (const tempban of expired) {
            await processExpiredBan(client, tempban);
        }
    }, TEMPBAN_SWEEP_MS);
}
