import { expect, test } from '@playwright/test';
import {
  addMember,
  createCampaign,
  registerUser,
  signInAs,
} from './support/api';

test('creates the first campaign from the empty state', async ({ page, request }) => {
  const owner = await registerUser(request, 'Мастер');
  await signInAs(page, owner);
  await page.goto('/campaigns');

  await expect(page.getByRole('button', { name: 'Новая кампания' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Создать первую кампанию' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новая кампания' });
  await dialog.getByLabel('Название').fill('Лето в Мэларёарна');
  await dialog.getByLabel('Описание').fill('Странные машины у озера.');

  // The browser blocks submission until a game system is chosen.
  await dialog.getByRole('button', { name: 'Создать кампанию' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Игровая система').selectOption({ index: 1 });
  await dialog.getByRole('button', { name: 'Создать кампанию' }).click();

  await expect(dialog).toHaveCount(0);
  const card = page.getByRole('link', { name: /Лето в Мэларёарна/ });
  await expect(card).toContainText('Мастер');
  await card.click();
  await expect(page).toHaveURL(/\/campaigns\/[^/]+\/characters$/);
});

test('M10: the owner edits and deletes a campaign; members lose it', async ({
  page,
  browser,
  request,
}) => {
  const owner = await registerUser(request, 'Мастер');
  const player = await registerUser(request, 'Игрок');
  const campaignId = await createCampaign(request, owner, 'Черновик');
  await addMember(request, owner, campaignId, player, 'PLAYER');

  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}`);
  await page
    .locator('.campaign-workspace-shell-navigation')
    .getByRole('link', { name: 'Настройки кампании' })
    .click();
  const details = page.locator('form').filter({ hasText: 'Основные сведения' });
  await details.getByLabel('Название').fill('Финальная версия');
  await details.getByLabel('Описание').fill('Обновлённое описание.');
  await details.getByRole('button', { name: 'Сохранить' }).click();
  await expect(details.getByText('Сохранено')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Финальная версия' })).toBeVisible();

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await signInAs(playerPage, player);
  await playerPage.goto('/campaigns');
  await expect(playerPage.getByRole('link', { name: /Финальная версия/ })).toBeVisible();
  await playerPage.goto(`/campaigns/${campaignId}/settings`);
  await expect(playerPage.getByRole('alert')).toHaveText('Ресурс недоступен.');

  // Dismissing the native confirmation keeps the campaign.
  page.once('dialog', (dialog) => void dialog.dismiss());
  await page.getByRole('button', { name: 'Удалить кампанию' }).click();
  await expect(page).toHaveURL(`/campaigns/${campaignId}/settings`);

  page.once('dialog', (dialog) => {
    expect(dialog.message()).toContain('Финальная версия');
    void dialog.accept();
  });
  await page.getByRole('button', { name: 'Удалить кампанию' }).click();
  await expect(page).toHaveURL(/\/campaigns$/);
  await expect(page.getByRole('heading', { name: 'Здесь пока нет кампаний' })).toBeVisible();

  await playerPage.goto('/campaigns');
  await expect(playerPage.getByRole('heading', { name: 'Здесь пока нет кампаний' })).toBeVisible();
  await playerContext.close();
});
