import { expect, test } from './support/test';
import {
  addMember,
  createCampaign,
  registerUser,
  signInAs,
} from './support/api';

test('creates the first campaign from the empty state', async ({
  page,
  request,
}) => {
  const owner = await registerUser(request, 'Мастер');
  await signInAs(page, owner);
  await page.goto('/campaigns');

  await expect(
    page.getByRole('button', { name: 'Новая кампания' }),
  ).toHaveCount(0);
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
  await expect(
    page.getByRole('heading', { name: 'Финальная версия' }),
  ).toBeVisible();

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await signInAs(playerPage, player);
  await playerPage.goto('/campaigns');
  await expect(
    playerPage.getByRole('link', { name: /Финальная версия/ }),
  ).toBeVisible();
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
  await expect(
    page.getByRole('heading', { name: 'Здесь пока нет кампаний' }),
  ).toBeVisible();

  await playerPage.goto('/campaigns');
  await expect(
    playerPage.getByRole('heading', { name: 'Здесь пока нет кампаний' }),
  ).toBeVisible();
  await playerContext.close();
});

test('the whole campaign card opens the campaign', async ({
  page,
  request,
}) => {
  const owner = await registerUser(request, 'Мастер');
  const campaignId = await createCampaign(request, owner, 'Остров');
  await signInAs(page, owner);
  await page.goto('/campaigns');

  // No separate small open button: a click on the description text is enough.
  const card = page.getByRole('link', { name: /Остров/ });
  await expect(card.getByRole('button')).toHaveCount(0);
  await card.getByText('Кампания для браузерных тестов').click();
  await expect(page).toHaveURL(`/campaigns/${campaignId}/characters`);
});

for (const viewport of [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'phone', width: 390, height: 800 },
]) {
  test(`account settings and sign-out are reachable from the list and the workspace (${viewport.name})`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize(viewport);
    const owner = await registerUser(request, 'Мастер');
    const campaignId = await createCampaign(request, owner);
    await signInAs(page, owner);

    // From the campaign list.
    await page.goto('/campaigns');
    await page.getByRole('link', { name: 'Мастер', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Настройки аккаунта' }),
    ).toBeVisible();
    await page.goto('/campaigns');
    await page.getByRole('button', { name: 'Выйти' }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    // From the workspace: the visible account link leads to settings, which
    // offer sign-out on every screen size.
    await signInAs(page, owner);
    await page.goto(`/campaigns/${campaignId}/characters`);
    await page
      .getByRole('link', { name: /^(Мастер|Настройки аккаунта)$/ })
      .filter({ visible: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Настройки аккаунта' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Выйти' }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await page.goto(`/campaigns/${campaignId}/characters`);
    await expect(page).toHaveURL(/\/sign-in/);
  });
}

test('backgrounds are configured inside campaign settings, not in the main navigation', async ({
  page,
  request,
}) => {
  const owner = await registerUser(request, 'Мастер');
  const campaignId = await createCampaign(request, owner);
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/characters`);

  const navigation = page.locator('.campaign-workspace-shell-navigation');
  await expect(navigation.getByRole('link', { name: 'Фоны' })).toHaveCount(0);
  await navigation.getByRole('link', { name: 'Настройки кампании' }).click();
  await page.getByRole('link', { name: 'Фоны' }).click();
  await expect(page).toHaveURL(`/campaigns/${campaignId}/settings/backgrounds`);
  await expect(
    page.getByRole('heading', { name: 'Фоны кампании' }),
  ).toBeVisible();
});
