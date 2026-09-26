import { expect, test } from '@playwright/test';
import {
  createCampaignWithRoles,
  createFreeCard,
  registerUser,
  signInAs,
} from './support/api';

const sidebar = '.campaign-workspace-shell-navigation';

test('M5: a viewer reads the board and catalog without editing controls', async ({
  page,
  request,
}) => {
  const { campaignId, owner, viewer } = await createCampaignWithRoles(request);
  await createFreeCard(request, owner, campaignId, 'Сломанный робот', {
    x: 100,
    y: 100,
  });

  await signInAs(page, viewer);
  await page.goto(`/campaigns/${campaignId}`);

  const navigation = page.locator(sidebar);
  await expect(navigation.getByRole('link')).toHaveText([
    'Доска расследования',
    'Персонажи',
    'Каталог',
  ]);

  await navigation.getByRole('link', { name: 'Доска расследования' }).click();
  await expect(page.getByText(/^Режим просмотра/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Новая карточка' })).toHaveCount(0);
  const card = page.locator('.react-flow__node', { hasText: 'Сломанный робот' });
  await expect(card).toBeVisible();

  // Clicking a card must not open the inspector for a viewer. The read-only
  // canvas takes the pointer, so click by coordinates like a user would.
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  if (!box) throw new Error('Card is not visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(
    page.getByRole('heading', { name: 'Редактирование карточки' }),
  ).toHaveCount(0);

  await navigation.getByRole('link', { name: 'Каталог' }).click();
  await expect(page.getByRole('button', { name: 'Новый элемент' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Новая заметка' })).toHaveCount(0);

  for (const section of ['members', 'settings']) {
    await page.goto(`/campaigns/${campaignId}/${section}`);
    await expect(page.getByRole('alert')).toHaveText('Ресурс недоступен.');
    await expect(page.locator(sidebar)).toHaveCount(0);
  }
});

test('an outsider gets the neutral unavailable state on a direct board URL', async ({
  page,
  request,
}) => {
  const { campaignId } = await createCampaignWithRoles(request);
  const outsider = await registerUser(request, 'Посторонний');

  await signInAs(page, outsider);
  await page.goto(`/campaigns/${campaignId}/board`);

  await expect(page.getByRole('alert')).toHaveText('Этот ресурс недоступен.');
  await expect(page.locator('.react-flow')).toHaveCount(0);
});

test('the owner sees members and campaign settings in the navigation', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);

  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}`);

  await expect(page.locator(sidebar).getByRole('link')).toHaveText([
    'Доска расследования',
    'Персонажи',
    'Каталог',
    'Участники',
    'Настройки кампании',
  ]);
});
