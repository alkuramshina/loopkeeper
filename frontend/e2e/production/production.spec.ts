import { expect, test } from '@playwright/test';

test('production bundle signs in, restores a deep route and signs out over TLS', async ({
  page,
}) => {
  const email = `browser-${Date.now()}@smoke.invalid`;
  const password = 'Production-browser-password';
  const registration = await page.request.post('/api/auth/register', {
    data: { email, name: 'Production browser', password },
  });
  expect(registration.status()).toBe(201);
  const { accessToken } = await registration.json();
  const campaign = await page.request.post('/api/campaigns', {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      title: 'Production browser campaign',
      system: 'TALES_FROM_THE_LOOP',
    },
  });
  expect(campaign.status()).toBe(201);
  const { campaignId } = await campaign.json();
  await page.context().clearCookies();
  await page.goto('/sign-in');
  await page.getByLabel('Электронная почта').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/campaigns$/);
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === 'refresh_token',
  );
  expect(cookie).toMatchObject({
    secure: true,
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
  });
  await page.goto(`/campaigns/${campaignId}/board`);
  await expect(page.locator('.campaign-identity')).toContainText(
    'Production browser campaign',
  );
  await page.reload();
  await expect(page.locator('.campaign-identity')).toContainText(
    'Production browser campaign',
  );
  await expect(page).toHaveURL(new RegExp(`/campaigns/${campaignId}/board$`));
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect(
    (await page.context().cookies()).find((c) => c.name === 'refresh_token'),
  ).toBeUndefined();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'С возвращением' }),
  ).toBeVisible();
});
