import { BaseCommand, BaseSubCommand } from '../structures/Command.ts';
import { BotClient } from '../client/BotClient.ts';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

export class CommandManager {
    private client: BotClient;

    constructor(client: BotClient) {
        this.client = client;
    }

    public async loadCommands(commandsDir: string) {
        try {
            const files = await readdir(commandsDir);

            for (const file of files) {
                const fullPath = join(commandsDir, file);
                const stats = await stat(fullPath);

                if (stats.isDirectory()) {
                    // Handle Subcommand Group (Folder)
                    const handled = await this.loadSubcommandGroup(fullPath, file);
                    if (!handled) {
                        // Treat as a category folder and recurse
                        await this.loadCommands(fullPath);
                    }
                } else if (file.endsWith('.ts') || file.endsWith('.js')) {
                    // Handle Single Command
                    await this.loadCommand(fullPath);
                }
            }
        } catch (error) {
            console.error('Error loading commands:', error);
        }
    }

    private async loadCommand(filePath: string) {
        try {
            const module = await import(filePath);
            const CommandClass = module.default;

            if (CommandClass && CommandClass.prototype instanceof BaseCommand) {
                const command: BaseCommand = new CommandClass();
                this.client.commands.set(command.data.name, command);
                console.log(`Loaded command: ${command.data.name}`);
            }
        } catch (error) {
            console.error(`Failed to load command at ${filePath}:`, error);
        }
    }

    private async loadSubcommandGroup(folderPath: string, folderName: string): Promise<boolean> {
        // Look for index.ts/js as the Parent Command
        const files = await readdir(folderPath);
        const indexFile = files.find(f => f === 'index.ts' || f === 'index.js');

        if (!indexFile) {
            return false;
        }

        try {
            const indexPath = join(folderPath, indexFile);
            const module = await import(indexPath);
            const CommandClass = module.default;

            if (CommandClass && CommandClass.prototype instanceof BaseCommand) {
                const parentCommand: BaseCommand = new CommandClass();
                
                // Load subcommands
                for (const file of files) {
                    if (file === indexFile || (!file.endsWith('.ts') && !file.endsWith('.js'))) continue;
                    
                    const subPath = join(folderPath, file);
                    const subModule = await import(subPath);
                    const SubCommandClass = subModule.default;

                    if (SubCommandClass && SubCommandClass.prototype instanceof BaseSubCommand) {
                        const subcommand: BaseSubCommand = new SubCommandClass();
                        parentCommand.subcommands.set(subcommand.data.name, subcommand);
                        console.log(`Loaded subcommand: ${parentCommand.data.name} -> ${subcommand.data.name}`);
                    }
                }

                this.client.commands.set(parentCommand.data.name, parentCommand);
                console.log(`Loaded parent command: ${parentCommand.data.name} with ${parentCommand.subcommands.size} subcommands`);
            }
        } catch (error) {
            console.error(`Failed to load subcommand group at ${folderPath}:`, error);
        }
        return true;
    }
}
