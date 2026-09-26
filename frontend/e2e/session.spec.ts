import { expect, test } from '@playwright/test';
import {
  createCampaignWithRoles,
  createFreeCard,
  signInAs,
} from './support/api';

test('M3: an expired access token is refreshed once and the requests are retried', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  await createFreeCard(request, owner, campaignId, 'Сигнал в эфире', {
    x: 0,
    y: 0,
  });
  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/elements`);
  const navigation = page.locator('.campaign-workspace-shell-navigation');
  await expect(navigation).toBeVisible();

  // Learn the access token the app holds in memory, then make the API treat
  // it as expired: every request that still carries it gets a real 401.
  const tokenRequest = page.waitForRequest((outgoing) =>
    Boolean(outgoing.headers().authorization),
  );
  await page.reload();
  const expired = (await tokenRequest).headers().authorization;
  await expect(navigation).toBeVisible();

  let refreshes = 0;
  let rejected = 0;
  page.on('request', (outgoing) => {
    if (outgoing.url().endsWith('/api/auth/refresh')) refreshes += 1;
  });
  await page.route('**/api/**', (route) => {
    const headers = route.request().headers();
    if (headers.authorization !== expired) return route.continue();
    rejected += 1;
    return route.continue({
      headers: { ...headers, authorization: 'Bearer expired-token' },
    });
  });

  // The board loads the campaign and the board in parallel: both get 401.
  await navigation.getByRole('link', { name: 'Доска расследования' }).click();
  await expect(
    page.locator('.react-flow__node', { hasText: 'Сигнал в эфире' }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/campaigns/${campaignId}/board$`));
  expect(rejected).toBeGreaterThanOrEqual(2);
  expect(refreshes).toBe(1);

  // Later requests use the new token without another refresh.
  await navigation.getByRole('link', { name: 'Персонажи' }).click();
  await expect(
    page.getByRole('heading', { name: 'Персонажи' }).first(),
  ).toBeVisible();
  expect(refreshes).toBe(1);
});
