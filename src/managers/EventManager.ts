import { BaseEvent } from '../structures/Event.ts';
import { BotClient } from '../client/BotClient.ts';
import { readdir } from 'fs/promises';
import { join } from 'path';

export class EventManager {
    private client: BotClient;

    constructor(client: BotClient) {
        this.client = client;
    }

    public async loadEvents(eventsDir: string) {
        try {
            const files = await readdir(eventsDir);

            for (const file of files) {
                if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;

                const filePath = join(eventsDir, file);
                try {
                    const module = await import(filePath);
                    const EventClass = module.default;

                    if (EventClass && EventClass.prototype instanceof BaseEvent) {
                        const event: BaseEvent<any> = new EventClass();
                        
                        if (event.once) {
                            this.client.once(event.name, (...args) => event.execute(this.client, ...args));
                        } else {
                            this.client.on(event.name, (...args) => event.execute(this.client, ...args));
                        }

                        console.log(`Loaded event: ${event.name}`);
                    }
                } catch (error) {
                    console.error(`Failed to load event at ${filePath}:`, error);
                }
            }
        } catch (error) {
            console.error('Error loading events:', error);
        }
    }
}
