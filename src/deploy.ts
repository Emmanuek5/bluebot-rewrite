import { REST, Routes } from 'discord.js';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { BaseCommand, BaseSubCommand } from './structures/Command.ts';

type DeployOptions = {
    token: string | undefined;
    clientId: string | undefined;
    guildId?: string | undefined;
    exitOnFail?: boolean;
};

const commands: any[] = [];
const commandsDir = join(process.cwd(), 'src', 'commands');

async function loadCommands(dir: string) {
    try {
        const files = await readdir(dir);

        for (const file of files) {
            const fullPath = join(dir, file);
            const stats = await stat(fullPath);

            if (stats.isDirectory()) {
                const handled = await loadSubcommandGroup(fullPath, file);
                if (!handled) {
                    await loadCommands(fullPath);
                }
            } else if (file.endsWith('.ts') || file.endsWith('.js')) {
                await loadCommand(fullPath);
            }
        }
    } catch (error) {
        console.error('Error loading commands:', error);
    }
}

async function loadCommand(filePath: string) {
    try {
        const module = await import(filePath);
        const CommandClass = module.default;

        if (CommandClass && CommandClass.prototype instanceof BaseCommand) {
            const command: BaseCommand = new CommandClass();
            commands.push(command.data.toJSON());
            console.log(`Loaded command for deploy: ${command.data.name}`);
        }
    } catch (error) {
        console.error(`Failed to load command at ${filePath}:`, error);
    }
}

async function loadSubcommandGroup(folderPath: string, folderName: string): Promise<boolean> {
    const files = await readdir(folderPath);
    const indexFile = files.find(f => f === 'index.ts' || f === 'index.js');

    if (!indexFile) return false;

    try {
        const indexPath = join(folderPath, indexFile);
        const module = await import(indexPath);
        const CommandClass = module.default;

        if (CommandClass && CommandClass.prototype instanceof BaseCommand) {
            const parentCommand: BaseCommand = new CommandClass();
            
            // In a real deploy script, we might need to manually construct the subcommand structure 
            // if the main command builder doesn't already have them added.
            // However, usually the BaseCommand's data (SlashCommandBuilder) should be configured 
            // by the developer to include subcommands, OR we dynamically add them here.
            
            // For this architecture, let's assume the developer defines the structure in the Parent Command's data
            // BUT we should verify if we need to dynamically inject them based on the files.
            // A truly dynamic system would read the subcommand files and `.addSubcommand()` to the parent builder.
            
            // Let's implement the dynamic injection to be helpful:
            for (const file of files) {
                if (file === indexFile || (!file.endsWith('.ts') && !file.endsWith('.js'))) continue;
                
                const subPath = join(folderPath, file);
                const subModule = await import(subPath);
                const SubCommandClass = subModule.default;

                if (SubCommandClass && SubCommandClass.prototype instanceof BaseSubCommand) {
                    const subcommand: BaseSubCommand = new SubCommandClass();
                    // We need to cast because the base builder types can be tricky
                    (parentCommand.data as any).addSubcommand(subcommand.data);
                    console.log(`  + Subcommand: ${subcommand.data.name}`);
                }
            }

            commands.push(parentCommand.data.toJSON());
            console.log(`Loaded parent command for deploy: ${parentCommand.data.name}`);
        }
    } catch (error) {
        console.error(`Failed to load subcommand group at ${folderPath}:`, error);
    }
    return true;
}

export async function deployCommands(options: DeployOptions) {
    const { token, clientId, guildId, exitOnFail = false } = options;

    if (!token || !clientId) {
        const message = 'Missing DISCORD_TOKEN or CLIENT_ID in environment variables.';
        if (exitOnFail) {
            console.error(message);
            process.exit(1);
        }
        console.warn(message);
        return;
    }

    commands.length = 0;
    await loadCommands(commandsDir);

    const rest = new REST().setToken(token);

    try {
        console.log(`Clearing old application (/) commands...`);

        const route = guildId 
            ? Routes.applicationGuildCommands(clientId, guildId)
            : Routes.applicationCommands(clientId);

        // await rest.put(route, { body: [] });

        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(route, { body: commands });

        console.log(`Successfully reloaded ${Array.isArray(data) ? data.length : 'unknown'} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
}

if (import.meta.main) {
    deployCommands({
        token: process.env.DISCORD_TOKEN,
        clientId: process.env.CLIENT_ID,
        guildId: process.env.GUILD_ID,
        exitOnFail: true,
    });
}
