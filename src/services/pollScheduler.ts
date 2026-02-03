import type { Client } from 'discord.js';
import PollModel from '../database/models/Poll.ts';
import { buildPollComponents, buildPollEmbed } from './polls.ts';

const POLL_SWEEP_MS = 60_000;

async function closePoll(client: Client, poll: any) {
    poll.isClosed = true;
    await poll.save();

    try {
        const guild = client.guilds.cache.get(poll.guildId);
        const channel = await guild?.channels.fetch(poll.channelId);
        if (channel && channel.isTextBased()) {
            const message = await channel.messages.fetch(poll.messageId);
            const embed = buildPollEmbed(poll);
            const components = buildPollComponents(poll);
            await message.edit({ embeds: [embed], components });
        }
    } catch {
        // Ignore missing message/channel
    }
}

export function startPollScheduler(client: Client) {
    setInterval(async () => {
        const now = new Date();
        const polls = await PollModel.find({
            isClosed: false,
            endsAt: { $ne: null, $lte: now },
        }).limit(25);

        for (const poll of polls) {
            await closePoll(client, poll);
        }
    }, POLL_SWEEP_MS);
}
