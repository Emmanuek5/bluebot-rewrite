import { BaseAutocomplete } from '../structures/Autocomplete.ts';
import type { AutocompleteInteraction, Client } from 'discord.js';
import { ensureGuildConfig } from '../database/guildConfig.ts';

function clampLabel(label: string, max = 90) {
    if (label.length <= max) return label;
    return `${label.slice(0, max - 3)}...`;
}

export default class AutoResponderAutocomplete extends BaseAutocomplete {
    constructor() {
        super('autoresponder', ['id']);
    }

    public override async execute(interaction: AutocompleteInteraction, client: Client): Promise<void> {
        if (!interaction.inGuild()) {
            await interaction.respond([]);
            return;
        }

        const focused = interaction.options.getFocused(true);
        if (focused.name !== 'id') {
            await interaction.respond([]);
            return;
        }

        const config = await ensureGuildConfig(interaction.guildId);
        const input = focused.value.trim().toLowerCase();

        let triggers = config.autoResponders as any[];
        if (input) {
            triggers = triggers.filter(
                (t) =>
                    t.keyword.toLowerCase().includes(input) ||
                    t._id?.toString().includes(input)
            );
        }

        const choices = triggers.slice(0, 25).map((t) => {
            const name = clampLabel(`${t.keyword} — ${t.response.slice(0, 60)} (AI: ${t.useAI ? 'Yes' : 'No'})`);
            return { name, value: t._id?.toString() ?? '' };
        });

        await interaction.respond(choices);
    }
}
