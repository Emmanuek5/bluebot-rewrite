import { AutocompleteInteraction, Client } from 'discord.js';

export abstract class BaseAutocomplete {
    public readonly commandName: string;
    public readonly optionNames?: string[];

    /**
     * @param commandName The name of the command this autocomplete belongs to.
     * @param optionNames Optional list of option names this handler specifically cares about.
     */
    constructor(commandName: string, optionNames?: string[]) {
        this.commandName = commandName;
        this.optionNames = optionNames;
    }

    public abstract execute(interaction: AutocompleteInteraction, client: Client): Promise<void>;
}
