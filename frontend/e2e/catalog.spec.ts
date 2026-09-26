import { Browser, expect, Page, test } from '@playwright/test';
import {
  createCampaignWithRoles,
  createElement,
  getBoard,
  listElementTitles,
  signInAs,
  TestUser,
} from './support/api';

async function openAs(browser: Browser, user: TestUser, path: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInAs(page, user);
  await page.goto(path);
  return page;
}

function detail(page: Page) {
  return page.locator('.note-detail');
}

function accessSaved(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().endsWith('/access') &&
      response.ok(),
  );
}

test('the master reveals a location, players pin it to the board, hiding it clears the board', async ({
  browser,
  page,
  request,
}) => {
  const { campaignId, owner, player, viewer } = await createCampaignWithRoles(request);
  const catalog = `/campaigns/${campaignId}/elements`;

  // The master prepares a location; it starts hidden from players.
  await signInAs(page, owner);
  await page.goto(catalog);
  await page.getByRole('button', { name: 'Новый элемент' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Тип').selectOption('LOCATION');
  await expect(dialog.getByLabel('Доступ').locator('option')).toHaveText([
    'Только мастер',
    'Всем',
  ]);
  await expect(dialog.getByLabel('Доступ')).toHaveValue('MASTER_ONLY');
  await dialog.getByLabel('Название').fill('Старая вышка');
  await dialog.getByLabel('Текст (Markdown)').fill('Гудит по ночам.');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();

  await expect(detail(page).getByRole('heading', { name: 'Старая вышка' })).toBeVisible();
  await expect(detail(page).locator('.visibility-badge')).toHaveText('Только мастер');
  expect(await listElementTitles(request, player, campaignId)).toEqual([]);
  expect(await listElementTitles(request, viewer, campaignId)).toEqual([]);

  // Reveal it to everyone.
  const revealed = accessSaved(page);
  await detail(page).getByLabel('Доступ').selectOption('SHARED');
  await revealed;
  await expect(detail(page).locator('.visibility-badge')).toHaveText('Всем');

  // A player reads it without author controls and pins it to the board.
  const playerPage = await openAs(browser, player, catalog);
  await playerPage.getByRole('link', { name: /Старая вышка/ }).click();
  await expect(detail(playerPage)).toContainText('Гудит по ночам.');
  await expect(detail(playerPage)).toContainText('Автор: Мастер');
  for (const name of ['Редактировать', 'Удалить']) {
    await expect(detail(playerPage).getByRole('button', { name })).toHaveCount(0);
  }
  await expect(detail(playerPage).getByLabel('Доступ')).toHaveCount(0);
  const pinned = playerPage.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/cards') &&
      response.status() === 201,
  );
  await detail(playerPage).getByRole('button', { name: 'Добавить на доску' }).click();
  await pinned;

  // Pinning twice is refused with a localized conflict.
  await detail(playerPage).getByRole('button', { name: 'Добавить на доску' }).click();
  await expect(playerPage.getByRole('alert')).toHaveText(
    'Невозможно сохранить изменения из-за конфликта данных.',
  );

  await playerPage.goto(`/campaigns/${campaignId}/board`);
  const card = playerPage.locator('.react-flow__node', { hasText: 'Старая вышка' });
  await expect(card).toBeVisible();

  // A viewer reads the revealed location but cannot pin it.
  const viewerPage = await openAs(browser, viewer, catalog);
  await viewerPage.getByRole('link', { name: /Старая вышка/ }).click();
  await expect(detail(viewerPage)).toContainText('Гудит по ночам.');
  await expect(
    detail(viewerPage).getByRole('button', { name: 'Добавить на доску' }),
  ).toHaveCount(0);

  // Hiding asks for confirmation; dismissing keeps everything as it was.
  let patches = 0;
  page.on('request', (outgoing) => {
    if (outgoing.method() === 'PATCH' && outgoing.url().endsWith('/access')) patches += 1;
  });
  page.once('dialog', (confirm) => void confirm.dismiss());
  await detail(page).getByLabel('Доступ').selectOption('MASTER_ONLY');
  await expect(detail(page).getByLabel('Доступ')).toHaveValue('SHARED');
  expect(patches).toBe(0);
  expect((await getBoard(request, owner, campaignId)).cards).toHaveLength(1);

  page.once('dialog', (confirm) => void confirm.accept());
  const hidden = accessSaved(page);
  await detail(page).getByLabel('Доступ').selectOption('MASTER_ONLY');
  await hidden;

  await playerPage.getByRole('button', { name: 'Обновить' }).click();
  await expect(card).toHaveCount(0);
  await playerPage.goto(catalog);
  await expect(playerPage.getByText('Здесь пока ничего нет.')).toBeVisible();
  expect((await getBoard(request, owner, campaignId)).cards).toHaveLength(0);
});

test('a player keeps a private note and then shows it to the master only', async ({
  browser,
  page,
  request,
}) => {
  const { campaignId, owner, player, viewer } = await createCampaignWithRoles(request);
  const catalog = `/campaigns/${campaignId}/elements`;

  await signInAs(page, player);
  await page.goto(catalog);
  await expect(page.getByRole('button', { name: 'Новый элемент' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Новая заметка' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Тип')).toBeDisabled();
  await expect(dialog.getByLabel('Тип')).toHaveValue('NOTE');
  await expect(dialog.getByLabel('Доступ')).toHaveValue('PRIVATE');
  await expect(dialog.getByLabel('Доступ').locator('option')).toHaveText([
    'Лично',
    'Мастеру',
    'Всем',
  ]);
  await dialog.getByLabel('Название').fill('Подозрение');
  await dialog.getByLabel('Текст (Markdown)').fill('Сторож что-то скрывает.');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();

  await expect(detail(page).getByRole('heading', { name: 'Подозрение' })).toBeVisible();
  await expect(detail(page).locator('.visibility-badge')).toHaveText('Лично');
  const noteUrl = page.url();

  // Private: nobody else sees it, not even the master, not even by URL.
  expect(await listElementTitles(request, owner, campaignId)).toEqual([]);
  const ownerPage = await openAs(browser, owner, noteUrl);
  await expect(ownerPage.getByRole('alert')).toHaveText('Ресурс недоступен.');

  const toMaster = accessSaved(page);
  await detail(page).getByLabel('Доступ').selectOption('MASTER_ONLY');
  await toMaster;
  await expect(detail(page).locator('.visibility-badge')).toHaveText('Мастеру');

  await ownerPage.reload();
  await expect(detail(ownerPage).getByRole('heading', { name: 'Подозрение' })).toBeVisible();
  await expect(detail(ownerPage).locator('.visibility-badge')).toHaveText('Мастеру');
  await expect(detail(ownerPage)).toContainText('Автор: Игрок');
  for (const name of ['Редактировать', 'Удалить', 'Добавить на доску']) {
    await expect(detail(ownerPage).getByRole('button', { name })).toHaveCount(0);
  }
  await expect(detail(ownerPage).getByLabel('Доступ')).toHaveCount(0);
  expect(await listElementTitles(request, viewer, campaignId)).toEqual([]);

  // The author edits the note; the change reaches the master.
  await detail(page).getByRole('button', { name: 'Редактировать' }).click();
  await page.getByRole('dialog').getByLabel('Название').fill('Подозрение: сторож');
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click();
  await expect(
    detail(page).getByRole('heading', { name: 'Подозрение: сторож' }),
  ).toBeVisible();
  expect(await listElementTitles(request, owner, campaignId)).toEqual([
    'Подозрение: сторож',
  ]);

  // Deleting asks for confirmation and removes it from the catalog.
  page.once('dialog', (confirm) => void confirm.accept());
  await detail(page).getByRole('button', { name: 'Удалить' }).click();
  await expect(page).toHaveURL(new RegExp(`${catalog}$`));
  await expect(page.getByText('Здесь пока ничего нет.')).toBeVisible();
  expect(await listElementTitles(request, owner, campaignId)).toEqual([]);
});

test('the catalog filters by type and searches titles and text', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  await createElement(request, owner, campaignId, {
    type: 'NPC',
    title: 'Сторож Берг',
    typeData: { role: 'Сторож' },
  });
  await createElement(request, owner, campaignId, {
    type: 'LOCATION',
    title: 'Ферма',
    content: 'Здесь нашли **следы робота**.',
  });
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/elements`);

  const list = page.getByLabel('Каталог кампании');
  const items = list.locator('.note-list-item strong');
  await expect(items).toHaveText(['Сторож Берг', 'Ферма']);

  await list.getByRole('button', { name: 'NPC' }).click();
  await expect(items).toHaveText(['Сторож Берг']);
  await list.getByRole('link', { name: 'Все' }).click();

  await page.getByPlaceholder('Поиск по каталогу').fill('робот');
  await expect(items).toHaveText(['Ферма']);
  await items.first().click();
  await expect(detail(page).locator('strong', { hasText: 'следы робота' })).toBeVisible();
});
