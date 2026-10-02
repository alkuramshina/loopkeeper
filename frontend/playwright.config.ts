import { randomUUID } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

// Browser tests run against their own API and Vite servers so they never touch
// the development database or a developer's running servers.
const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 3100);
const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 5174);
const mediaPrefix =
  process.env.LOOPKEEPER_BROWSER_MEDIA_PREFIX ??
  'tests/browser-' + randomUUID();
process.env.LOOPKEEPER_BROWSER_MEDIA_PREFIX = mediaPrefix;
process.env.S3_KEY_PREFIX = mediaPrefix;
const webUrl = `http://localhost:${webPort}`;

export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/support/media-storage.ts',
  // Every spec creates its own users and campaigns, but the API shares one
  // in-memory throttler and one database, so keep runs deterministic.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: webUrl,
    locale: 'ru-RU',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Locally the installed Google Chrome is used, so no browser download
        // is needed. CI uses the downloaded Playwright build. Override with
        // PLAYWRIGHT_CHANNEL (e.g. `chromium` for the downloaded build).
        channel:
          process.env.PLAYWRIGHT_CHANNEL ??
          (process.env.CI ? undefined : 'chrome'),
      },
    },
  ],
  webServer: [
    {
      // Migrate and reset loopkeeper_test first; the helper refuses any other database.
      command:
        'npm run test:browser:prepare && npx ts-node --transpile-only src/main.ts',
      cwd: '..',
      url: `http://localhost:${apiPort}/health/ready`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        NODE_ENV: 'test',
        PORT: String(apiPort),
        FRONTEND_URL: webUrl,
        DATABASE_URL:
          process.env.LOOPKEEPER_TEST_DATABASE_URL ??
          'postgresql://loopkeeper:loopkeeper@localhost:5434/loopkeeper_test',
        JWT_SECRET: 'browser-test-access-secret-long-enough',
        REFRESH_JWT_SECRET: 'browser-test-refresh-secret-long-enough',
        INVITATION_SECRET: 'browser-test-invitation-secret-long-enough',
        REFRESH_COOKIE_SECURE: 'false',
        REFRESH_COOKIE_SAMESITE: 'lax',
        S3_ENDPOINT: 'http://localhost:9002',
        S3_REGION: 'us-east-1',
        S3_BUCKET: 'loopkeeper-test',
        S3_ACCESS_KEY_ID: 'loopkeeper-test-app',
        S3_SECRET_ACCESS_KEY: 'loopkeeper-test-app-secret',
        S3_FORCE_PATH_STYLE: 'true',
        S3_KEY_PREFIX: mediaPrefix,
        THROTTLE_LIMIT: '10000',
        AUTH_THROTTLE_LIMIT: '10000',
      },
    },
    {
      command: `npx vite --port ${webPort} --strictPort`,
      url: webUrl,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        LOOPKEEPER_API_PROXY_TARGET: `http://localhost:${apiPort}`,
      },
    },
  ],
});
