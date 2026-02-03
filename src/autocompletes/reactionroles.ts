import { BaseAutocomplete } from '../structures/Autocomplete.ts';
import type { AutocompleteInteraction, Client } from 'discord.js';
import ReactionRolePanelModel from '../database/models/ReactionRolePanel.ts';

function clampLabel(label: string, max = 90) {
    if (label.length <= max) return label;
    return `${label.slice(0, max - 3)}...`;
}

export default class ReactionRolesAutocomplete extends BaseAutocomplete {
    constructor() {
        super('reactionroles', ['panel_id']);
    }

    public override async execute(interaction: AutocompleteInteraction, client: Client): Promise<void> {
        if (!interaction.inGuild()) {
            await interaction.respond([]);
            return;
        }

        const focused = interaction.options.getFocused(true);
        if (focused.name !== 'panel_id') {
            await interaction.respond([]);
            return;
        }

        const panels = await ReactionRolePanelModel.find({ guildId: interaction.guildId })
            .sort({ createdAt: -1 })
            .limit(25);

        const choices = panels.map((panel) => {
            const name = clampLabel(`${panel.title} (${panel.items.length} roles)`);
            return { name, value: panel.id };
        });

        await interaction.respond(choices);
    }
}
