import { execFileSync } from 'node:child_process';
import {
  applyTestMigrations,
  closeTestDatabase,
  resetTestDatabase,
} from '../helpers/database';
import {
  configureTestEnvironment,
  getTestDatabaseUrl,
} from '../helpers/test-environment';

// Prepares loopkeeper_test for Playwright with migrations, reset, and current
// reference data before the browser servers start.
async function prepareBrowserTestDatabase(): Promise<void> {
  configureTestEnvironment();
  getTestDatabaseUrl();
  applyTestMigrations();
  await resetTestDatabase();
  await closeTestDatabase();
  execFileSync(
    process.execPath,
    [require.resolve('ts-node/dist/bin.js'), 'prisma/seed.ts'],
    {
      env: {
        ...process.env,
        DATABASE_URL: getTestDatabaseUrl(),
        SEED_ADMIN: 'false',
      },
      stdio: 'inherit',
    },
  );
}

prepareBrowserTestDatabase().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
