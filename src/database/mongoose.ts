import mongoose from 'mongoose';
import { MONGO_DB, MONGO_URI } from '../config.ts';

let isConnected = false;

export async function connectMongo() {
    if (isConnected) return;

    if (!MONGO_URI) {
        console.error('MONGO_URI is not defined in the environment variables.');
        process.exit(1);
    }

    mongoose.connection.on('connected', () => {
        console.log('MongoDB connected.');
    });

    mongoose.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
        console.log('MongoDB reconnected.');
    });

    mongoose.connection.on('error', (error) => {
        console.error('MongoDB connection error:', error);
    });

    await mongoose.connect(MONGO_URI, {
        dbName: MONGO_DB,
    });

    isConnected = true;
}
