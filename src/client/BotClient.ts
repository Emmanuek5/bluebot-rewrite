import { Client, ClientOptions, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { BaseCommand } from '../structures/Command.ts';
import { BaseInteraction } from '../structures/Interaction.ts';
import { BaseAutocomplete } from '../structures/Autocomplete.ts';
import { CommandManager } from '../managers/CommandManager.ts';
import { EventManager } from '../managers/EventManager.ts';
import { InteractionManager } from '../managers/InteractionManager.ts';
import { join } from 'path';
import { connectMongo } from '../database/mongoose.ts';

export class BotClient extends Client {
    public commands: Collection<string, BaseCommand>;
    public interactions: Collection<string, BaseInteraction>;
    public autocompletes: Collection<string, BaseAutocomplete>;

    private commandManager: CommandManager;
    private eventManager: EventManager;
    private interactionManager: InteractionManager;

    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
            ],
            partials: [Partials.Message, Partials.Channel, Partials.Reaction]
        });

        this.commands = new Collection();
        this.interactions = new Collection();
        this.autocompletes = new Collection();

        this.commandManager = new CommandManager(this);
        this.eventManager = new EventManager(this);
        this.interactionManager = new InteractionManager(this);
    }

    public async start(token: string) {
        await connectMongo();
        await this.loadModules();
        
        // Bind the interaction handler globally
        this.on('interactionCreate', (interaction) => {
            this.interactionManager.handleInteraction(interaction);
        });

        await this.login(token);
    }

    private async loadModules() {
        const rootDir = process.cwd();
        
        await this.commandManager.loadCommands(join(rootDir, 'src', 'commands'));
        await this.eventManager.loadEvents(join(rootDir, 'src', 'events'));
        await this.interactionManager.loadInteractions(join(rootDir, 'src', 'interactions'));
        await this.interactionManager.loadAutocompletes(join(rootDir, 'src', 'autocompletes'));
    }
}
