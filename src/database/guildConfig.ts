import type { HydratedDocument } from 'mongoose';
import GuildConfigModel, { type GuildConfig } from './models/GuildConfig.ts';

export async function ensureGuildConfig(guildId: string): Promise<HydratedDocument<GuildConfig>> {
    return GuildConfigModel.findOneAndUpdate(
        { guildId },
        { $setOnInsert: { guildId } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
}

export async function getGuildConfig(guildId: string) {
    return GuildConfigModel.findOne({ guildId });
}
