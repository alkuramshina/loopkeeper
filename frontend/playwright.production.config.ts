import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/production',
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.PRODUCTION_SMOKE_URL ?? 'https://localhost:8443',
    // Opt in only for the controlled local/CI CA. A real domain verifies TLS.
    ignoreHTTPSErrors: process.env.SMOKE_INTERNAL_TLS === 'true',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.CI ? undefined : 'chrome',
      },
    },
  ],
});
