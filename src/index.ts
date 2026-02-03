import { BotClient } from './client/BotClient.ts';

const client = new BotClient();

const token = process.env.DISCORD_TOKEN;

if (!token) {
    console.error('DISCORD_TOKEN is not defined in the environment variables.');
    process.exit(1);
}

client.start(token);
