import { BaseAutocomplete } from '../structures/Autocomplete.ts';
import type { AutocompleteInteraction, Client } from 'discord.js';
import ModerationCaseModel from '../database/models/ModerationCase.ts';

function clampLabel(label: string, max = 90) {
    if (label.length <= max) return label;
    return `${label.slice(0, max - 3)}...`;
}

export default class CaseAutocomplete extends BaseAutocomplete {
    constructor() {
        super('case', ['number']);
    }

    public override async execute(interaction: AutocompleteInteraction, client: Client): Promise<void> {
        if (!interaction.inGuild()) {
            await interaction.respond([]);
            return;
        }

        const focused = interaction.options.getFocused(true);
        if (focused.name !== 'number') {
            await interaction.respond([]);
            return;
        }

        const input = focused.value.trim();
        const query: Record<string, any> = { guildId: interaction.guildId };

        // If the user typed a number, filter by case number prefix
        if (input && !isNaN(Number(input))) {
            const num = parseInt(input, 10);
            // Match cases starting with the typed digits
            const lower = num * Math.pow(10, Math.max(0, 4 - input.length));
            const upper = (num + 1) * Math.pow(10, Math.max(0, 4 - input.length));
            query.caseNumber = { $gte: num, $lt: upper > num + 1 ? upper : num + 1 };
            // Simpler: just find the exact number or nearby
            delete query.caseNumber;
            query.caseNumber = num;
        }

        let cases;
        if (input && !isNaN(Number(input))) {
            // Try exact match first, then show recent
            const exact = await ModerationCaseModel.findOne(query).lean();
            const recent = await ModerationCaseModel.find({ guildId: interaction.guildId })
                .sort({ caseNumber: -1 })
                .limit(24)
                .lean();
            cases = exact ? [exact, ...recent.filter((c) => c.caseNumber !== exact.caseNumber)] : recent;
        } else {
            cases = await ModerationCaseModel.find({ guildId: interaction.guildId })
                .sort({ caseNumber: -1 })
                .limit(25)
                .lean();
        }

        const choices = cases.slice(0, 25).map((c) => {
            const name = clampLabel(`#${c.caseNumber} — ${c.action.toUpperCase()} — ${c.targetTag} — ${c.reason}`);
            return { name, value: String(c.caseNumber) };
        });

        await interaction.respond(choices);
    }
}
