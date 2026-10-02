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
    page.getByRole('button', { name: 'Создать кампанию' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Создать первую кампанию' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новая кампания' });
  await dialog.getByLabel('Название').fill('Лето в Мэларёарна');
  await dialog.getByLabel('Описание').fill('Странные машины у озера.');

  // The browser blocks submission until a game system is chosen.
  await dialog.getByRole('button', { name: 'Создать' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Игровая система').selectOption({ index: 1 });
  await dialog.getByRole('button', { name: 'Создать' }).click();

  await expect(dialog).toHaveCount(0);
  const card = page.getByRole('link', { name: /Лето в Мэларёарна/ });
  await expect(card).toContainText('Мастер');
  await card.click();
  await expect(page).toHaveURL(/\/campaigns\/[^/]+\/board$/);
});

for (const width of [320, 768]) {
  test(`F13b navigation and campaign list fit ${width}px`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height: 740 });
    const owner = await registerUser(request, 'Мастер');
    const campaignId = await createCampaign(request, owner, 'Сигнал');
    await signInAs(page, owner);
    await page.goto('/campaigns');
    await expect(page.locator('.campaign-card')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.goto(`/campaigns/${campaignId}/settings`);
    const navigation = page.locator('.campaign-workspace-shell-sidebar');
    await page.getByRole('button', { name: 'Меню' }).click();
    await expect(navigation).toBeVisible();
    await expect(
      navigation.getByRole('link', { name: 'Сведения о кампании' }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}

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
  const navigation = page.locator('.campaign-workspace-shell-navigation');
  await navigation.getByRole('button', { name: 'Настройки' }).click();
  await navigation.getByRole('link', { name: 'Сведения о кампании' }).click();
  await expect(page).toHaveURL(`/campaigns/${campaignId}/settings`);
  const details = page.getByRole('main').locator('form');
  await details.getByLabel('Название').fill('Финальная версия');
  await details.getByLabel('Описание').fill('Обновлённое описание.');
  await details.getByRole('button', { name: 'Сохранить' }).click();
  await expect(details.getByText('Сохранено')).toBeVisible();
  await page.reload();
  await expect(page.locator('.campaign-identity')).toContainText(
    'Финальная версия',
  );

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await signInAs(playerPage, player);
  await playerPage.goto('/campaigns');
  await expect(
    playerPage.getByRole('link', { name: /Финальная версия/ }),
  ).toBeVisible();
  await playerPage.goto(`/campaigns/${campaignId}/settings`);
  await expect(playerPage.getByRole('alert')).toHaveText('Ресурс недоступен.');

  await navigation.getByRole('link', { name: 'Удаление кампании' }).click();
  await expect(page).toHaveURL(`/campaigns/${campaignId}/settings/delete`);
  await page.getByRole('button', { name: 'Удалить кампанию' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Отмена' })
    .click();
  await expect(page).toHaveURL(`/campaigns/${campaignId}/settings/delete`);

  await page.getByRole('button', { name: 'Удалить кампанию' }).click();
  await expect(page.getByRole('dialog')).toContainText('Финальная версия');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Удалить кампанию' })
    .click();
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
  await expect(page).toHaveURL(`/campaigns/${campaignId}/board`);
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
    const openMenu = async () => {
      if (viewport.width < 1024)
        await page.getByRole('button', { name: 'Меню' }).click();
    };

    // From the campaign list.
    await page.goto('/campaigns');
    await openMenu();
    await page.locator('.sidebar-profile').click();
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible();
    await page.goto('/campaigns');
    await openMenu();
    await page.getByRole('button', { name: 'Выйти' }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    // The profile stays at the bottom of the same sidebar in the workspace.
    await signInAs(page, owner);
    await page.goto(`/campaigns/${campaignId}/characters`);
    await openMenu();
    await page.locator('.sidebar-profile').click();
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible();
    await openMenu();
    await page.getByRole('button', { name: 'Выйти' }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await page.goto(`/campaigns/${campaignId}/characters`);
    await expect(page).toHaveURL(/\/sign-in/);
  });
}

test('the campaign sidebar keeps its layout and typography', async ({
  page,
  request,
}) => {
  const owner = await registerUser(request, 'Мастер');
  const campaignId = await createCampaign(request, owner);
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/characters`);

  const navigation = page.locator('.campaign-workspace-shell-navigation');
  await expect(navigation).toBeVisible();
  await expect(page.locator('.sidebar-logo-link')).toHaveAttribute(
    'href',
    '/campaigns',
  );
  await expect(
    navigation.getByRole('link', { name: 'Все кампании' }),
  ).toHaveCount(0);
  const sidebarStyle = await page
    .locator('.campaign-workspace-shell-sidebar')
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        width: element.getBoundingClientRect().width,
        left: style.borderLeftWidth,
        right: style.borderRightWidth,
      };
    });
  expect(sidebarStyle).toEqual({ width: 248, left: '0px', right: '1px' });
  const searchStyle = await page
    .locator('.campaign-search-trigger:not([data-quick-note-trigger])')
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        height: element.getBoundingClientRect().height,
        border: style.borderTopWidth,
        font: style.fontFamily,
      };
    });
  expect(searchStyle.height).toBe(40);
  expect(searchStyle.border).toBe('0px');
  expect(searchStyle.font).toContain('Golos Text');
  const navFont = await navigation
    .getByRole('link', { name: 'Доска расследования' })
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return { family: style.fontFamily, weight: style.fontWeight };
    });
  expect(navFont.family).toContain('Golos Text');
  expect(navFont.weight).toBe('500');
  await expect(page.locator('.sidebar-profile')).toContainText('Профиль');
  await expect(page.locator('.sidebar-profile')).not.toContainText('Мастер');
});
