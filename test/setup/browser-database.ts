import {
  applyTestMigrations,
  closeTestDatabase,
  resetTestDatabase,
} from '../helpers/database';
import {
  configureTestEnvironment,
  getTestDatabaseUrl,
} from '../helpers/test-environment';

// Prepares loopkeeper_test for the frontend Playwright suite: the same
// migrations and reset as Jest E2E, run once before the browser servers start.
async function prepareBrowserTestDatabase(): Promise<void> {
  configureTestEnvironment();
  getTestDatabaseUrl();
  applyTestMigrations();
  await resetTestDatabase();
  await closeTestDatabase();
}

prepareBrowserTestDatabase().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
