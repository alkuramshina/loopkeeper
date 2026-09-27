import { expect, Page, test } from './support/test';
import {
  createCampaignWithRoles,
  createElement,
  getBoard,
  listElementTitles,
  openAs,
  signInAs,
} from './support/api';

function detail(page: Page) {
  return page.getByRole('article');
}

function list(page: Page) {
  return page.getByRole('navigation', { name: 'Список материалов' });
}

function accessSaved(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().endsWith('/access') &&
      response.ok(),
  );
}

async function openMenuItem(page: Page, name: string) {
  await detail(page).getByRole('button', { name: 'Ещё действия' }).click();
  await page.getByRole('menuitem', { name }).click();
}

test('F13d: the master writes a location, reveals it after a preview, and hiding it clears the board', async ({
  browser,
  page,
  request,
}) => {
  const { campaignId, owner, player, viewer } =
    await createCampaignWithRoles(request);
  const catalog = `/campaigns/${campaignId}/elements`;

  // A new material starts from its type and name and is hidden from players.
  await signInAs(page, owner);
  await page.goto(catalog);
  await expect(
    page.getByRole('heading', { name: 'Материалов пока нет' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Материал' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Новый материал' });
  await expect(dialog).toContainText(
    'Материал будет скрыт от игроков, пока вы его не откроете.',
  );
  await expect(dialog.getByLabel('Доступ')).toHaveCount(0);
  await dialog.getByLabel('Тип').selectOption('LOCATION');
  await dialog.getByLabel('Название').fill('Старая вышка');
  await dialog.getByRole('button', { name: 'Создать' }).click();

  // It opens for writing; the text is saved without a save button.
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      /\/elements\/[^/]+$/.test(response.url()) &&
      response.ok(),
  );
  await detail(page).getByLabel('Текст').fill('Гудит по ночам.');
  await expect(detail(page).getByRole('status')).toHaveText('Сохраняется…');
  await saved;
  await expect(detail(page).getByRole('status')).toHaveText('Сохранено');
  await detail(page).getByRole('button', { name: 'Готово' }).click();
  await expect(
    detail(page).getByRole('heading', { name: 'Старая вышка' }),
  ).toBeVisible();
  await expect(detail(page)).toContainText('Гудит по ночам.');
  await expect(detail(page)).toContainText('Изменено сегодня');
  await expect(
    list(page).getByRole('region', { name: 'Локации' }).getByRole('link'),
  ).toHaveText('Старая вышкаСкрыто');
  expect(await listElementTitles(request, player, campaignId)).toEqual([]);
  expect(await listElementTitles(request, viewer, campaignId)).toEqual([]);

  // Revealing shows exactly what players get and who will see it.
  await detail(page).getByRole('button', { name: 'Открыть игрокам…' }).click();
  const reveal = page.getByRole('dialog', {
    name: 'Открыть игрокам материал «Старая вышка»?',
  });
  await expect(
    reveal.getByRole('region', { name: 'Так увидят игроки' }),
  ).toContainText('Гудит по ночам.');
  await expect(reveal).toContainText('Увидят 2 участника');
  await expect(reveal).toContainText('Игрок и наблюдатель Наблюдатель');
  const revealed = accessSaved(page);
  await reveal.getByRole('button', { name: 'Открыть игрокам' }).click();
  await revealed;
  await expect(reveal).toHaveCount(0);
  await expect(
    detail(page).getByText('Открыто', { exact: true }),
  ).toBeVisible();
  await expect(
    detail(page).getByRole('button', { name: 'Скрыть от игроков…' }),
  ).toBeVisible();

  // A player reads it without author controls and pins it to the board.
  const playerPage = await openAs(browser, player, catalog);
  await expect(playerPage.getByRole('heading', { name: 'Дело' })).toBeVisible();
  await list(playerPage)
    .getByRole('link', { name: /Старая вышка/ })
    .click();
  await expect(detail(playerPage)).toContainText('Гудит по ночам.');
  await expect(detail(playerPage)).toContainText('Автор: Мастер');
  await expect(
    detail(playerPage).getByRole('button', { name: 'Изменить' }),
  ).toHaveCount(0);
  const pinned = playerPage.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/cards') &&
      response.status() === 201,
  );
  await openMenuItem(playerPage, 'Добавить на доску');
  await pinned;
  await expect(
    playerPage
      .getByRole('status')
      .filter({ hasText: 'Материал добавлен на доску' }),
  ).toBeVisible();
  await expect(
    playerPage.getByRole('menuitem', { name: 'Удалить' }),
  ).toHaveCount(0);

  // Pinning twice is refused in plain words.
  await openMenuItem(playerPage, 'Добавить на доску');
  await expect(
    playerPage
      .getByRole('status')
      .filter({ hasText: 'Этот материал уже на доске.' }),
  ).toBeVisible();

  await playerPage.goto(`/campaigns/${campaignId}/board`);
  const card = playerPage.locator('.react-flow__node', {
    hasText: 'Старая вышка',
  });
  await expect(card).toBeVisible();

  // A viewer reads the revealed location but has no actions on it.
  const viewerPage = await openAs(browser, viewer, catalog);
  await list(viewerPage)
    .getByRole('link', { name: /Старая вышка/ })
    .click();
  await expect(detail(viewerPage)).toContainText('Гудит по ночам.');
  await expect(
    detail(viewerPage).getByRole('button', { name: 'Ещё действия' }),
  ).toHaveCount(0);

  // Hiding names its consequence; cancelling keeps everything as it was.
  let patches = 0;
  page.on('request', (outgoing) => {
    if (outgoing.method() === 'PATCH' && outgoing.url().endsWith('/access'))
      patches += 1;
  });
  await detail(page)
    .getByRole('button', { name: 'Скрыть от игроков…' })
    .click();
  const hide = page.getByRole('dialog', {
    name: 'Скрыть от игроков материал «Старая вышка»?',
  });
  await expect(hide).toContainText('С доски уберутся 1 карточка и 0 связей.');
  await hide.getByRole('button', { name: 'Отмена' }).click();
  expect(patches).toBe(0);
  expect((await getBoard(request, owner, campaignId)).cards).toHaveLength(1);

  await detail(page)
    .getByRole('button', { name: 'Скрыть от игроков…' })
    .click();
  const hidden = accessSaved(page);
  await hide.getByRole('button', { name: 'Скрыть от игроков' }).click();
  await hidden;
  await expect(detail(page).getByText('Скрыто', { exact: true })).toBeVisible();

  await playerPage.getByRole('button', { name: 'Обновить' }).click();
  await expect(card).toHaveCount(0);
  await playerPage.goto(catalog);
  await expect(playerPage.getByText('Здесь пока ничего нет.')).toBeVisible();
  expect((await getBoard(request, owner, campaignId)).cards).toHaveLength(0);
});

test('F13d: a player keeps a private note, shows it to the master, edits and deletes it', async ({
  browser,
  page,
  request,
}) => {
  const { campaignId, owner, player, viewer } =
    await createCampaignWithRoles(request);
  const catalog = `/campaigns/${campaignId}/elements`;

  await signInAs(page, player);
  await page.goto(catalog);
  await expect(page.getByRole('button', { name: 'Материал' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Заметка' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Новая заметка' });
  await expect(dialog.getByLabel('Тип')).toHaveCount(0);
  await expect(dialog.getByRole('radio', { name: 'Личное' })).toBeChecked();
  await dialog.getByLabel('Название').fill('Подозрение');
  await dialog.getByRole('button', { name: 'Создать' }).click();
  await detail(page).getByLabel('Текст').fill('Сторож что-то скрывает.');
  await expect(detail(page).getByRole('status')).toHaveText('Сохранено');
  const noteUrl = page.url();

  // Private: nobody else sees it, not even the master, not even by URL.
  expect(await listElementTitles(request, owner, campaignId)).toEqual([]);
  const ownerPage = await openAs(browser, owner, noteUrl);
  await expect(
    ownerPage.getByRole('heading', { name: 'Материал недоступен' }),
  ).toBeVisible();
  await expect(ownerPage.getByText('Возможно, ссылка устарела.')).toBeVisible();

  const visibility = detail(page).getByRole('radiogroup', {
    name: 'Кто увидит',
  });
  const toMaster = accessSaved(page);
  await visibility.getByText('Мастеру').click();
  await toMaster;
  await expect(
    visibility.getByRole('radio', { name: 'Мастеру' }),
  ).toBeChecked();

  await ownerPage.reload();
  await expect(
    detail(ownerPage).getByRole('heading', { name: 'Подозрение' }),
  ).toBeVisible();
  await expect(detail(ownerPage).getByText('Мастеру')).toBeVisible();
  await expect(detail(ownerPage)).toContainText('Автор: Игрок');
  await expect(
    list(ownerPage).getByRole('region', { name: 'Заметки игроков' }),
  ).toContainText('Подозрение');
  for (const name of ['Изменить', 'Ещё действия', 'Открыть игрокам…'])
    await expect(detail(ownerPage).getByRole('button', { name })).toHaveCount(
      0,
    );
  expect(await listElementTitles(request, viewer, campaignId)).toEqual([]);

  // The author edits the note in place; the change reaches the master.
  await detail(page).getByRole('button', { name: 'Изменить' }).click();
  await detail(page).getByLabel('Название').fill('Подозрение: сторож');
  await expect(detail(page).getByRole('status')).toHaveText('Сохранено');
  await detail(page).getByRole('button', { name: 'Готово' }).click();
  await expect(
    detail(page).getByRole('heading', { name: 'Подозрение: сторож' }),
  ).toBeVisible();
  expect(await listElementTitles(request, owner, campaignId)).toEqual([
    'Подозрение: сторож',
  ]);

  // Deleting can be undone for a few seconds; closing the notice commits it.
  await openMenuItem(page, 'Удалить');
  await expect(page).toHaveURL(new RegExp(`${catalog}$`));
  const notice = page.getByRole('status').filter({
    hasText: '«Подозрение: сторож» будет удалён',
  });
  await notice.getByRole('button', { name: 'Отменить' }).click();
  await expect(list(page)).toContainText('Подозрение: сторож');
  expect(await listElementTitles(request, owner, campaignId)).toHaveLength(1);

  await list(page)
    .getByRole('link', { name: /Подозрение/ })
    .click();
  await openMenuItem(page, 'Удалить');
  const deleted = page.waitForResponse(
    (response) => response.request().method() === 'DELETE' && response.ok(),
  );
  await page
    .getByRole('status')
    .filter({ hasText: 'будет удалён' })
    .getByRole('button', { name: 'Закрыть' })
    .click();
  await deleted;
  await expect(page.getByText('Здесь пока ничего нет.')).toBeVisible();
  expect(await listElementTitles(request, owner, campaignId)).toEqual([]);
});

test('F13d: the master filters materials by access and searches titles and text', async ({
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
    access: 'SHARED',
  });
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/elements`);

  const rows = list(page).getByRole('link');
  await expect(rows).toHaveText(['ФермаОткрыто', 'Сторож БергСкрыто']);
  await expect(list(page).getByRole('heading')).toHaveText([
    'Локации1',
    'NPC1',
  ]);

  const filter = page.getByRole('radiogroup', { name: 'Показать материалы' });
  await filter.getByText('Скрыто').click();
  await expect(rows).toHaveText(['Сторож БергСкрыто']);
  await filter.getByText('Все').click();

  await page.getByPlaceholder('Фильтр по названию и тексту').fill('робот');
  await expect(rows).toHaveText(['ФермаОткрыто']);
  await rows.first().click();
  await expect(
    detail(page).locator('strong', { hasText: 'следы робота' }),
  ).toBeVisible();
});
