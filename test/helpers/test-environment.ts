import { randomUUID } from 'node:crypto';
export const TEST_DATABASE_NAME = 'loopkeeper_test';
const runPrefix =
  process.env.LOOPKEEPER_BROWSER_MEDIA_PREFIX ??
  process.env.LOOPKEEPER_TEST_MEDIA_PREFIX ??
  'tests/' + randomUUID();
process.env.LOOPKEEPER_TEST_MEDIA_PREFIX = runPrefix;

export function configureTestEnvironment(): void {
  process.env.NODE_ENV = 'test';
  process.env.FRONTEND_URL =
    process.env.FRONTEND_URL ?? 'http://localhost:3000';
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ??
    'postgresql://loopkeeper:loopkeeper@localhost:5434/loopkeeper_test';
  process.env.JWT_SECRET =
    process.env.JWT_SECRET ?? 'test-access-secret-that-is-long-enough';
  process.env.REFRESH_JWT_SECRET =
    process.env.REFRESH_JWT_SECRET ?? 'test-refresh-secret-that-is-long-enough';
  process.env.INVITATION_SECRET =
    process.env.INVITATION_SECRET ??
    'test-invitation-secret-that-is-long-enough';
  process.env.REFRESH_COOKIE_NAME =
    process.env.REFRESH_COOKIE_NAME ?? 'refresh_token';
  process.env.REFRESH_COOKIE_SECURE =
    process.env.REFRESH_COOKIE_SECURE ?? 'false';
  process.env.REFRESH_COOKIE_SAMESITE =
    process.env.REFRESH_COOKIE_SAMESITE ?? 'lax';
  process.env.S3_ENDPOINT = 'http://localhost:9002';
  process.env.S3_REGION = 'us-east-1';
  process.env.S3_BUCKET = 'loopkeeper-test';
  process.env.S3_ACCESS_KEY_ID = 'loopkeeper-test-app';
  process.env.S3_SECRET_ACCESS_KEY = 'loopkeeper-test-app-secret';
  process.env.S3_FORCE_PATH_STYLE = 'true';
  process.env.S3_KEY_PREFIX = runPrefix;
}

export function getTestDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for E2E tests.');
  }

  const { pathname } = new URL(databaseUrl);
  if (pathname !== `/${TEST_DATABASE_NAME}`) {
    throw new Error(
      `Refusing to run E2E tests against ${pathname}. Expected /${TEST_DATABASE_NAME}.`,
    );
  }

  return databaseUrl;
}
