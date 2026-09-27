import { expect, test as base } from '@playwright/test';

export * from '@playwright/test';

// Checks shared by every browser test.
export const test = base.extend<{ noCredentialsInUrls: void }>({
  // Access tokens travel in headers and the refresh token in an HttpOnly
  // cookie; neither may appear in a request URL (history, logs, Referer).
  noCredentialsInUrls: [
    async ({ context }, use) => {
      const leaks: string[] = [];
      context.on('request', (request) => {
        const url = request.url();
        if (
          /eyJ[\w-]+\.[\w-]+\./.test(url) ||
          /[?&](access_?token|refresh_?token|token|password)=/i.test(url)
        )
          leaks.push(url);
      });
      await use();
      expect(leaks, 'credentials in request URLs').toEqual([]);
    },
    { auto: true },
  ],
});
