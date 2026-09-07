/**
 * Idempotent development seed (CLI entrypoint).
 *
 *   npm run seed            # upsert reference data, create demo txns if absent
 *   npm run seed -- --fresh # drop app collections first, then reseed
 *
 * NOT run at server startup. Refuses to run against NODE_ENV=production unless
 * SEED_ALLOW_PROD=true is explicitly set.
 */
import { connectDb, disconnectDb } from './config/db';
import { logger } from './lib/logger';
import { seedDatabase } from './seed/run';

const fresh = process.argv.includes('--fresh');

async function main() {
  await connectDb();
  const result = await seedDatabase({ fresh });

  logger.info('---');
  logger.info('Seed complete. Development accounts:');
  logger.info(`  ADMIN     ${result.admin}`);
  for (const pu of result.partners) logger.info(`  PARTNER   ${pu.email} / ${pu.password}`);
  for (const c of result.citizens) logger.info(`  CITIZEN   ${c.email} / ${c.password}`);

  await disconnectDb();
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, 'seed failed');
  process.exit(1);
});
