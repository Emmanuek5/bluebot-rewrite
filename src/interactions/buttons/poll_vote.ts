import { BaseInteraction } from '../../structures/Interaction.ts';
import type { AnySelectMenuInteraction, ButtonInteraction, Client } from 'discord.js';
import PollModel from '../../database/models/Poll.ts';
import { buildPollComponents, buildPollEmbed } from '../../services/polls.ts';

function extractIds(customId: string) {
    const parts = customId.split(':');
    return {
        pollId: parts[1],
        optionId: parts[2],
    };
}

export default class PollVoteInteraction extends BaseInteraction {
    constructor() {
        super('poll', 'button');
    }

    public override async execute(
        interaction: ButtonInteraction | AnySelectMenuInteraction,
        client: Client
    ): Promise<void> {
        if (!interaction.inGuild()) return;

        const { pollId, optionId } = extractIds(interaction.customId);
        if (!pollId) return;

        const poll = await PollModel.findById(pollId);
        if (!poll) return;

        const now = Date.now();
        if (poll.endsAt && poll.endsAt.getTime() <= now) {
            poll.isClosed = true;
            await poll.save();
            const embed = buildPollEmbed(poll);
            const components = buildPollComponents(poll);
            await interaction.update({ embeds: [embed], components });
            return;
        }

        if (poll.isClosed) {
            await interaction.reply({ content: 'This poll is closed.', ephemeral: true });
            return;
        }

        let chosen = optionId;
        if (interaction.isAnySelectMenu()) {
            chosen = interaction.values[0];
        }

        if (!chosen) return;

        for (const option of poll.options) {
            option.votes = option.votes.filter((id) => id !== interaction.user.id);
        }

        const target = poll.options.find((opt) => opt.optionId === chosen);
        if (target) {
            target.votes.push(interaction.user.id);
        }

        await poll.save();

        const embed = buildPollEmbed(poll);
        const components = buildPollComponents(poll);

        await interaction.update({ embeds: [embed], components });
    }
}
