import { Client, type ClientEvents } from 'discord.js';

export abstract class BaseEvent<K extends keyof ClientEvents> {
    public readonly name: K;
    public readonly once: boolean;

    constructor(name: K, once: boolean = false) {
        this.name = name;
        this.once = once;
    }

    public abstract execute(client: Client, ...args: ClientEvents[K]): Promise<void>;
}
