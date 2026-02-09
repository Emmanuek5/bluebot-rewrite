import { BaseAutocomplete } from '../structures/Autocomplete.ts';
import type { AutocompleteInteraction, Client } from 'discord.js';
import WarningModel from '../database/models/Warning.ts';

function clampLabel(label: string, max = 90) {
    if (label.length <= max) return label;
    return `${label.slice(0, max - 3)}...`;
}

export default class WarnAutocomplete extends BaseAutocomplete {
    constructor() {
        super('warn', ['id']);
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

        const query: Record<string, any> = { guildId: interaction.guildId };

        // If the user typed something, try to match by warning ID prefix or reason
        const input = focused.value.trim();
        if (input) {
            query.$or = [
                { _id: { $regex: `^${input}`, $options: 'i' } },
                { reason: { $regex: input, $options: 'i' } },
            ];
        }

        const warnings = await WarningModel.find(query)
            .sort({ createdAt: -1 })
            .limit(25)
            .lean();

        const choices = warnings.map((w) => {
            const date = new Date(w.createdAt!).toLocaleDateString();
            const name = clampLabel(`${w.reason} (user: ${w.userId}, ${date})`);
            return { name, value: (w as any)._id.toString() };
        });

        await interaction.respond(choices);
    }
}
