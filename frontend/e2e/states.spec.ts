import { expect, test } from './support/test';
import { createCampaignWithRoles, registerUser, signInAs } from './support/api';

// M13: loading, empty, unavailable and network failure must look different.

test('M13: a new campaign shows empty states, not errors', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  await signInAs(page, owner);

  const expectations: Array<[string, string]> = [
    ['characters', 'В кампании пока нет персонажей.'],
    ['elements', 'Здесь пока ничего нет.'],
    ['board', 'На доске пока нет карточек.'],
  ];
  for (const [section, text] of expectations) {
    await page.goto(`/campaigns/${campaignId}/${section}`);
    await expect(page.getByText(text)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
});

test('M13: an outsider gets the same neutral unavailable state everywhere', async ({
  page,
  request,
}) => {
  const { campaignId } = await createCampaignWithRoles(request);
  const outsider = await registerUser(request, 'Посторонний');
  await signInAs(page, outsider);

  for (const section of ['characters', 'elements', 'members', 'settings']) {
    await page.goto(`/campaigns/${campaignId}/${section}`);
    await expect(page.getByRole('alert')).toHaveText('Ресурс недоступен.');
    await expect(page.getByRole('button', { name: 'Повторить' })).toHaveCount(
      0,
    );
  }
});

test('M13: a failed load says so and recovers with a retry', async ({
  page,
  request,
}) => {
  const { campaignId, player } = await createCampaignWithRoles(request);
  await signInAs(page, player);

  // Campaign list: a failure must not look like "no campaigns yet".
  await page.route('**/api/campaigns', (route) =>
    route.abort('connectionrefused'),
  );
  await page.goto('/campaigns');
  await expect(page.getByRole('alert')).toHaveText(
    'Не удалось загрузить кампании. Нет связи с сервером. Проверьте подключение и попробуйте снова.',
  );
  await expect(page.getByText('Здесь пока нет кампаний')).toHaveCount(0);
  await page.unroute('**/api/campaigns');
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByRole('link', { name: /Тайна у озера/ })).toBeVisible();

  // A workspace page: network failure is not reported as "unavailable".
  await page.route('**/api/campaigns/*/characters', (route) =>
    route.abort('connectionrefused'),
  );
  await page.goto(`/campaigns/${campaignId}/characters`);
  await expect(page.getByRole('alert')).toHaveText(/^Нет связи с сервером/);
  await page.unroute('**/api/campaigns/*/characters');
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByText('В кампании пока нет персонажей.')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('M13: a slow list shows a loading state first', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  await signInAs(page, owner);
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/campaigns/*/elements', async (route) => {
    await held;
    await route.continue();
  });

  await page.goto(`/campaigns/${campaignId}/elements`);
  await expect(page.getByText('Загрузка…')).toBeVisible();
  release();
  await expect(page.getByText('Здесь пока ничего нет.')).toBeVisible();
  await expect(page.getByText('Загрузка…')).toHaveCount(0);
});
