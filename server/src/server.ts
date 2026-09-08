import { createApp } from './app';
import { connectDb, disconnectDb } from './config/db';
import { env } from './config/env';
import { logger } from './lib/logger';
import { ensureIndexes } from './lib/indexes';
import { User } from './models';
import { seedDatabase, syncReferenceData } from './seed/run';

async function maybeSeedOnBoot() {
  if (!env.SEED_ON_BOOT) return;
  const users = await User.estimatedDocumentCount();
  if (users > 0) {
    // Accounts/transactions already exist — just keep the scheme + partner
    // catalogue up to date with the latest fixtures.
    const ref = await syncReferenceData();
    logger.info(ref, 'SEED_ON_BOOT: users present — synced reference data only');
    return;
  }
  logger.warn('SEED_ON_BOOT: empty database — running idempotent seed');
  const result = await seedDatabase({ fresh: false });
  logger.warn(
    { admin: result.admin, partners: result.partners.length, citizens: result.citizens.length },
    'SEED_ON_BOOT: demo data created (change/disable SEED_* env vars for a real deployment)',
  );
}

async function main() {
  await connectDb();
  await ensureIndexes();

  const app = createApp();
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`SchemeFit AI API listening on :${env.PORT}/api/v1  (env: ${env.NODE_ENV})`);
    logger.info(`API docs: /api/v1/docs`);
  });

  // Run the optional boot seed AFTER the server is accepting connections, so a
  // slow or failing seed can never block the platform health check.
  void maybeSeedOnBoot().catch((err) =>
    logger.error({ err }, 'SEED_ON_BOOT failed — service continues without demo data'),
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'fatal startup error');
  process.exit(1);
});
