import { applyTestMigrations, closeTestDatabase } from '../helpers/database';
import {
  configureTestEnvironment,
  getTestDatabaseUrl,
} from '../helpers/test-environment';

export default async function globalSetup(): Promise<void> {
  configureTestEnvironment();
  getTestDatabaseUrl();
  applyTestMigrations();
  await closeTestDatabase();
}
