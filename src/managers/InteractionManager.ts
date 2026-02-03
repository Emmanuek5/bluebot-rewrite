import { BotClient } from '../client/BotClient.ts';
import { BaseInteraction } from '../structures/Interaction.ts';
import { BaseAutocomplete } from '../structures/Autocomplete.ts';
import { readdir } from 'fs/promises';
import { join } from 'path';
import type { Interaction } from 'discord.js';
import { ensureGuildConfig } from '../database/guildConfig.ts';

export class InteractionManager {
    private client: BotClient;

    constructor(client: BotClient) {
        this.client = client;
    }

    public async loadInteractions(interactionsDir: string) {
        await this.recursiveLoad(interactionsDir, this.loadInteractionFile.bind(this));
    }

    public async loadAutocompletes(autocompletesDir: string) {
        await this.recursiveLoad(autocompletesDir, this.loadAutocompleteFile.bind(this));
    }

    private async recursiveLoad(dir: string, loader: (path: string) => Promise<void>) {
        try {
            const files = await readdir(dir, { withFileTypes: true });
            for (const dirent of files) {
                const fullPath = join(dir, dirent.name);
                if (dirent.isDirectory()) {
                    await this.recursiveLoad(fullPath, loader);
                } else if (dirent.name.endsWith('.ts') || dirent.name.endsWith('.js')) {
                    await loader(fullPath);
                }
            }
        } catch (error) {
            // Directory might not exist yet, which is fine
            // console.warn(`Warning reading directory ${dir}: ${error}`);
        }
    }

    private async loadInteractionFile(filePath: string) {
        try {
            const module = await import(filePath);
            const InteractionClass = module.default;

            if (InteractionClass && InteractionClass.prototype instanceof BaseInteraction) {
                const interaction: BaseInteraction = new InteractionClass();
                this.client.interactions.set(interaction.customId, interaction);
                // console.log(`Loaded interaction handler: ${interaction.customId}`);
            }
        } catch (error) {
            console.error(`Failed to load interaction at ${filePath}:`, error);
        }
    }

    private async loadAutocompleteFile(filePath: string) {
        try {
            const module = await import(filePath);
            const AutocompleteClass = module.default;

            if (AutocompleteClass && AutocompleteClass.prototype instanceof BaseAutocomplete) {
                const autocomplete: BaseAutocomplete = new AutocompleteClass();
                this.client.autocompletes.set(autocomplete.commandName, autocomplete);
                console.log(`Loaded autocomplete handler for command: ${autocomplete.commandName}`);
            }
        } catch (error) {
            console.error(`Failed to load autocomplete at ${filePath}:`, error);
        }
    }

    public async handleInteraction(interaction: Interaction) {
        // 1. Slash Commands
        if (interaction.isChatInputCommand()) {
            if (interaction.inGuild()) {
                await ensureGuildConfig(interaction.guildId);
            }
            const command = this.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, this.client);
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
            }
            return;
        }

        // 2. Autocomplete
        if (interaction.isAutocomplete()) {
            const handler = this.client.autocompletes.get(interaction.commandName);
            if (!handler) return;

            try {
                await handler.execute(interaction, this.client);
            } catch (error) {
                console.error(error);
            }
            return;
        }

        // 3. Components (Buttons, Modals, Selects)
        if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
            // Find a handler that matches the customId
            // We iterate because we might have "startsWith" logic (e.g., "ticket:close:123")
            // Optimization: Look for exact match first
            let handler = this.client.interactions.get(interaction.customId);
            
            if (!handler) {
                // Fallback: choose the most specific matching handler (longest customId)
                handler = this.client.interactions.reduce((best, current) => {
                    if (!current.matches(interaction.customId)) return best;
                    if (!best) return current;
                    return current.customId.length > best.customId.length ? current : best;
                }, undefined as BaseInteraction | undefined);
            }

            if (handler) {
                try {
                    await handler.execute(interaction, this.client);
                } catch (error) {
                    console.error(error);
                }
            }
        }
    }
}
