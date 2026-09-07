import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../lib/logger';

mongoose.set('strictQuery', true);

let connected = false;

export async function connectDb(uri: string = env.mongoUrl): Promise<typeof mongoose> {
  if (connected) return mongoose;
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 20,
  });
  connected = true;
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
  return mongoose;
}

export async function disconnectDb(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
