import { BaseAutocomplete } from '../structures/Autocomplete.ts';
import type { AutocompleteInteraction, Client } from 'discord.js';
import PollModel from '../database/models/Poll.ts';

function clampLabel(label: string, max = 90) {
    if (label.length <= max) return label;
    return `${label.slice(0, max - 3)}...`;
}

export default class PollAutocomplete extends BaseAutocomplete {
    constructor() {
        super('poll', ['message_id']);
    }

    public override async execute(interaction: AutocompleteInteraction, client: Client): Promise<void> {
        if (!interaction.inGuild()) {
            await interaction.respond([]);
            return;
        }

        const focused = interaction.options.getFocused(true);
        if (focused.name !== 'message_id') {
            await interaction.respond([]);
            return;
        }

        const polls = await PollModel.find({ guildId: interaction.guildId })
            .sort({ createdAt: -1 })
            .limit(25);

        const choices = polls.map((poll) => {
            const name = clampLabel(`${poll.question} (${poll.isClosed ? 'closed' : 'open'})`);
            return { name, value: poll.messageId };
        });

        await interaction.respond(choices);
    }
}
