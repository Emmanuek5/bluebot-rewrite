import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    SlashCommandSubcommandBuilder,
    type SlashCommandSubcommandsOnlyBuilder,
    type SlashCommandOptionsOnlyBuilder,
    Collection,
    Client
} from 'discord.js';

export interface CommandOptions {
    cooldown?: number;
    userPermissions?: bigint[];
    botPermissions?: bigint[];
    devOnly?: boolean;
}

export abstract class BaseCommand {
    public readonly data:
        | SlashCommandBuilder
        | SlashCommandSubcommandsOnlyBuilder
        | SlashCommandOptionsOnlyBuilder;
    public readonly options: CommandOptions;
    public subcommands: Collection<string, BaseSubCommand> = new Collection();

    constructor(
        data:
            | SlashCommandBuilder
            | SlashCommandSubcommandsOnlyBuilder
            | SlashCommandOptionsOnlyBuilder,
        options: CommandOptions = {}
    ) {
        this.data = data;
        this.options = options;
    }

    public async execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
        const subcommandName = interaction.options.getSubcommand(false);
        if (subcommandName) {
            const subcommand = this.subcommands.get(subcommandName);
            if (subcommand) {
                try {
                    await subcommand.execute(interaction, client);
                } catch (error) {
                    console.error(`Error executing subcommand ${subcommandName} for command ${this.data.name}:`, error);
                    // Minimal error handling, can be expanded
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: 'There was an error executing this command!', ephemeral: true });
                    } else {
                        await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
                    }
                }
                return;
            }
        }
        
        // Default behavior if no subcommand or no matching subcommand (should be overridden if not using subcommands)
        await interaction.reply({ content: "Command execution logic not implemented.", ephemeral: true });
    }
}

export abstract class BaseSubCommand {
    public readonly data: SlashCommandSubcommandBuilder;

    constructor(data: SlashCommandSubcommandBuilder) {
        this.data = data;
    }

    public abstract execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void>;
}
