import { afterAll, afterEach, beforeAll } from 'vitest';
import mongoose from 'mongoose';
import { rm } from 'node:fs/promises';

const TEST_URI = process.env.MONGO_URL_TEST || 'mongodb://127.0.0.1:27017/schemefit_test';

/** Register DB lifecycle hooks for an integration suite. */
export function useTestDb(): void {
  beforeAll(async () => {
    await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 8000 });
    await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).createIndexes()));
  });

  afterEach(async () => {
    const { collections } = mongoose.connection;
    await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
    await rm('./var/test-uploads', { recursive: true, force: true });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
}
