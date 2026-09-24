export const TEST_DATABASE_NAME = 'loopkeeper_test';

export function configureTestEnvironment(): void {
  process.env.NODE_ENV = 'test';
  process.env.FRONTEND_URL =
    process.env.FRONTEND_URL ?? 'http://localhost:3000';
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ??
    'postgresql://loopkeeper:loopkeeper@localhost:5433/loopkeeper_test';
  process.env.JWT_SECRET =
    process.env.JWT_SECRET ?? 'test-access-secret-that-is-long-enough';
  process.env.REFRESH_JWT_SECRET =
    process.env.REFRESH_JWT_SECRET ?? 'test-refresh-secret-that-is-long-enough';
  process.env.REFRESH_COOKIE_NAME =
    process.env.REFRESH_COOKIE_NAME ?? 'refresh_token';
  process.env.REFRESH_COOKIE_SECURE =
    process.env.REFRESH_COOKIE_SECURE ?? 'false';
  process.env.REFRESH_COOKIE_SAMESITE =
    process.env.REFRESH_COOKIE_SAMESITE ?? 'lax';
  process.env.MEDIA_STORAGE_PATH =
    process.env.MEDIA_STORAGE_PATH ?? 'data/test-media';
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
