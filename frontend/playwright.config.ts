import { defineConfig, devices } from '@playwright/test';

// Browser tests run against their own API and Vite servers so they never touch
// the development database or a developer's running servers.
const apiPort = 3100;
const webPort = 5174;
const webUrl = `http://localhost:${webPort}`;

export default defineConfig({
  testDir: './e2e',
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
        // Optional: PLAYWRIGHT_CHANNEL=chrome uses an installed Chrome instead
        // of the downloaded Playwright build.
        channel: process.env.PLAYWRIGHT_CHANNEL,
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
          'postgresql://loopkeeper:loopkeeper@localhost:5433/loopkeeper_test',
        JWT_SECRET: 'browser-test-access-secret-long-enough',
        REFRESH_JWT_SECRET: 'browser-test-refresh-secret-long-enough',
        REFRESH_COOKIE_SECURE: 'false',
        REFRESH_COOKIE_SAMESITE: 'lax',
        MEDIA_STORAGE_PATH: 'data/browser-test-media',
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
