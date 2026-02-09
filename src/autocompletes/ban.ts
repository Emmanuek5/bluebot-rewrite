import { BaseAutocomplete } from '../structures/Autocomplete.ts';
import type { AutocompleteInteraction, Client } from 'discord.js';

function clampLabel(label: string, max = 90) {
    if (label.length <= max) return label;
    return `${label.slice(0, max - 3)}...`;
}

export default class BanAutocomplete extends BaseAutocomplete {
    constructor() {
        super('ban', ['user_id']);
    }

    public override async execute(interaction: AutocompleteInteraction, client: Client): Promise<void> {
        if (!interaction.inGuild()) {
            await interaction.respond([]);
            return;
        }

        const focused = interaction.options.getFocused(true);
        if (focused.name !== 'user_id') {
            await interaction.respond([]);
            return;
        }

        const input = focused.value.trim().toLowerCase();

        try {
            const bans = await interaction.guild?.bans.fetch({ limit: 100 });
            if (!bans || bans.size === 0) {
                await interaction.respond([]);
                return;
            }

            let filtered = [...bans.values()];

            if (input) {
                filtered = filtered.filter(
                    (ban) =>
                        ban.user.tag.toLowerCase().includes(input) ||
                        ban.user.id.includes(input) ||
                        ban.user.username.toLowerCase().includes(input)
                );
            }

            const choices = filtered.slice(0, 25).map((ban) => {
                const reason = ban.reason ? ` — ${ban.reason}` : '';
                const name = clampLabel(`${ban.user.tag} (${ban.user.id})${reason}`);
                return { name, value: ban.user.id };
            });

            await interaction.respond(choices);
        } catch {
            await interaction.respond([]);
        }
    }
}
