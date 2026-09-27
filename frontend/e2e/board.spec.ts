import { expect, Locator, Page, test } from './support/test';
import {
  createCampaignWithRoles,
  createFreeCard,
  getBoard,
  signInAs,
} from './support/api';

function boardCard(page: Page, title: string): Locator {
  return page.locator('.react-flow__node', { hasText: title });
}

function nodeSaved(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().includes('/api/investigation-board/nodes/') &&
      response.ok(),
  );
}

async function dragBy(page: Page, target: Locator, dx: number, dy: number) {
  // Mouse gestures do not scroll by themselves; the canvas is taller than the viewport.
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error('Element is not visible');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 5 });
  await page.mouse.move(x + dx, y + dy, { steps: 5 });
  await page.mouse.up();
}

test('M6: the owner creates a card with tags that survives refresh and reload', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/board`);

  await page.getByRole('button', { name: 'Новая карточка' }).click();
  await page.getByLabel('Название карточки').fill('Следы на снегу');
  await page.getByLabel('Текст').fill('Ведут к старой вышке.');
  const tagInput = page.getByRole('textbox', { name: 'Новый тег' });
  await tagInput.fill('улика');
  await tagInput.press('Enter');
  await tagInput.fill('улика');
  await tagInput.press('Enter');
  await expect(page.getByRole('button', { name: '#улика ×' })).toHaveCount(1);
  await page.getByLabel('Цвет карточки').selectOption('olive');
  await page.getByRole('button', { name: 'Сохранить' }).click();

  const card = boardCard(page, 'Следы на снегу');
  await expect(card).toBeVisible();
  await expect(card).toContainText('#улика');

  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect(boardCard(page, 'Следы на снегу')).toHaveCount(1);
  await page.reload();
  await expect(boardCard(page, 'Следы на снегу')).toHaveCount(1);

  const board = await getBoard(request, owner, campaignId);
  expect(board.cards).toHaveLength(1);
  expect(board.cards[0]).toMatchObject({
    title: 'Следы на снегу',
    tags: ['улика'],
  });
});

test('M6: a player drags, resizes and links cards; the layout persists', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  const radioId = await createFreeCard(
    request,
    owner,
    campaignId,
    'Радиосигнал',
    {
      x: 0,
      y: 0,
    },
  );
  await createFreeCard(request, owner, campaignId, 'Заброшенная ферма', {
    x: 600,
    y: 0,
  });
  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/board`);

  const radio = boardCard(page, 'Радиосигнал');
  const farm = boardCard(page, 'Заброшенная ферма');
  await expect(radio).toBeVisible();
  await expect(farm).toBeVisible();

  // Drag: the saved node moves down, the other card keeps its place.
  const dragged = nodeSaved(page);
  await dragBy(page, radio.locator('h3'), 0, 90);
  await dragged;
  let board = await getBoard(request, player, campaignId);
  const movedNode = board.cards.find((card) => card.cardId === radioId)?.node;
  expect(movedNode?.y).toBeGreaterThan(50);
  expect(Math.abs(movedNode?.x ?? 999)).toBeLessThan(20);

  // Resize: selecting the card shows the resizer; the saved width grows.
  await radio.locator('h3').click();
  await page.getByRole('button', { name: 'Отмена' }).click();
  const resized = nodeSaved(page);
  await dragBy(
    page,
    radio.locator('.react-flow__resize-control.handle.bottom.right'),
    80,
    40,
  );
  await resized;
  board = await getBoard(request, player, campaignId);
  const resizedNode = board.cards.find((card) => card.cardId === radioId)?.node;
  expect(resizedNode?.width).toBeGreaterThan(260);

  // Link the two cards with the board's linking tool.
  const linked = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/investigation-links') &&
      response.ok(),
  );
  await page.getByRole('button', { name: 'Связать' }).click();
  await farm.locator('h3').click();
  await radio.locator('h3').click();
  await linked;

  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(boardCard(page, 'Радиосигнал')).toHaveCount(1);

  board = await getBoard(request, player, campaignId);
  expect(board.links).toHaveLength(1);
  expect(
    board.cards.find((card) => card.cardId === radioId)?.node,
  ).toMatchObject({
    x: movedNode?.x,
    y: movedNode?.y,
    width: resizedNode?.width,
  });
});

test('M6: a viewer cannot move board cards', async ({ page, request }) => {
  const { campaignId, owner, viewer } = await createCampaignWithRoles(request);
  await createFreeCard(request, owner, campaignId, 'Неподвижная улика', {
    x: 0,
    y: 0,
  });
  let nodeUpdates = 0;
  page.on('request', (outgoing) => {
    if (outgoing.url().includes('/api/investigation-board/nodes/'))
      nodeUpdates += 1;
  });
  await signInAs(page, viewer);
  await page.goto(`/campaigns/${campaignId}/board`);

  const card = boardCard(page, 'Неподвижная улика');
  await expect(card).toBeVisible();
  await dragBy(page, card.locator('h3'), 0, 150);
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  if (!box) throw new Error('Card is not visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(
    page.getByRole('heading', { name: 'Редактирование карточки' }),
  ).toHaveCount(0);
  await expect(card.locator('.react-flow__resize-control')).toHaveCount(0);
  expect(nodeUpdates).toBe(0);
  const board = await getBoard(request, owner, campaignId);
  expect(board.cards[0].node).toMatchObject({ x: 0, y: 0 });
});

test('M7: a board survives an unreachable server and recovers on refresh', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  await createFreeCard(request, owner, campaignId, 'Первая улика', {
    x: 0,
    y: 0,
  });
  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/board`);
  await expect(boardCard(page, 'Первая улика')).toBeVisible();

  // The server is unreachable: an explicit network error, the cards stay.
  await page.route('**/api/**', (route) => route.abort('connectionrefused'));
  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect(page.getByRole('alert')).toHaveText(/^Нет связи с сервером/);
  await expect(boardCard(page, 'Первая улика')).toBeVisible();

  await page.getByRole('button', { name: 'Новая карточка' }).click();
  const editor = page
    .getByRole('complementary')
    .filter({ has: page.getByLabel('Название карточки') });
  await editor.getByLabel('Название карточки').fill('Вторая улика');
  await editor.getByRole('button', { name: 'Сохранить' }).click();
  await expect(editor.getByRole('alert')).toHaveText(/^Нет связи с сервером/);

  // The server is back: the same save succeeds, a refresh brings other changes.
  await page.unroute('**/api/**');
  await editor.getByRole('button', { name: 'Сохранить' }).click();
  await expect(editor).toHaveCount(0);
  await expect(boardCard(page, 'Вторая улика')).toBeVisible();
  await createFreeCard(request, owner, campaignId, 'Третья улика', {
    x: 600,
    y: 300,
  });
  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect(boardCard(page, 'Третья улика')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect((await getBoard(request, owner, campaignId)).cards).toHaveLength(3);
});

test('M7: an offline browser is told so and a pending save goes out on reconnect', async ({
  context,
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  await createFreeCard(request, owner, campaignId, 'Первая улика', {
    x: 0,
    y: 0,
  });
  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/board`);
  await expect(boardCard(page, 'Первая улика')).toBeVisible();

  await context.setOffline(true);
  const notice = page
    .getByRole('status')
    .filter({ hasText: 'Нет связи с сервером' });
  await expect(notice).toBeVisible();
  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect(boardCard(page, 'Первая улика')).toBeVisible();

  await page.getByRole('button', { name: 'Новая карточка' }).click();
  const editor = page
    .getByRole('complementary')
    .filter({ has: page.getByLabel('Название карточки') });
  await editor.getByLabel('Название карточки').fill('Записано без сети');
  await editor.getByRole('button', { name: 'Сохранить' }).click();
  await expect(
    editor.getByRole('button', { name: 'Сохранить' }),
  ).toBeDisabled();

  await context.setOffline(false);
  await expect(notice).toHaveCount(0);
  await expect(boardCard(page, 'Записано без сети')).toBeVisible();
  expect((await getBoard(request, owner, campaignId)).cards).toHaveLength(2);
});

test('an empty board says so', async ({ page, request }) => {
  const { campaignId, viewer } = await createCampaignWithRoles(request);
  await signInAs(page, viewer);
  await page.goto(`/campaigns/${campaignId}/board`);
  await expect(page.getByText('На доске пока нет карточек.')).toBeVisible();
});

test('F8: a refresh keeps the selection and a layout that is still being saved', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  await createFreeCard(request, owner, campaignId, 'Радиосигнал', {
    x: 0,
    y: 0,
  });
  await createFreeCard(request, owner, campaignId, 'Заброшенная ферма', {
    x: 600,
    y: 0,
  });
  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/board`);

  const radio = boardCard(page, 'Радиосигнал');
  const farm = boardCard(page, 'Заброшенная ферма');
  await farm.locator('h3').click();
  await page.getByRole('button', { name: 'Отмена' }).click();
  await expect(farm).toHaveClass(/selected/);

  // Another participant adds a card; a refresh brings it and keeps the selection.
  await createFreeCard(request, owner, campaignId, 'Третья улика', {
    x: 0,
    y: 400,
  });
  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect(boardCard(page, 'Третья улика')).toBeVisible();
  await expect(farm).toHaveClass(/selected/);

  // A refresh that lands before the position save must not move the card back.
  let releaseSave: () => void = () => undefined;
  const saveHeld = new Promise<void>((resolve) => (releaseSave = resolve));
  await page.route('**/api/investigation-board/nodes/*', async (route) => {
    await saveHeld;
    await route.fallback();
  });
  const before = await radio.boundingBox();
  await dragBy(page, radio.locator('h3'), 0, 150);
  const dragged = await radio.boundingBox();
  expect((dragged?.y ?? 0) - (before?.y ?? 0)).toBeGreaterThan(50);

  const refreshed = page.waitForResponse((response) =>
    response.url().endsWith('/investigation-board'),
  );
  await page.getByRole('button', { name: 'Обновить' }).click();
  await refreshed;
  expect((await radio.boundingBox())?.y).toBeCloseTo(dragged?.y ?? 0, 0);

  const saved = nodeSaved(page);
  releaseSave();
  await saved;
  await page.unroute('**/api/investigation-board/nodes/*');
  await page.getByRole('button', { name: 'Обновить' }).click();
  expect((await radio.boundingBox())?.y).toBeCloseTo(dragged?.y ?? 0, 0);
});

test('F8: Backspace does not remove a selected card behind the server', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  await createFreeCard(request, owner, campaignId, 'Хрупкая улика', {
    x: 0,
    y: 0,
  });
  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/board`);

  const card = boardCard(page, 'Хрупкая улика');
  await card.locator('h3').click();
  await page.getByRole('button', { name: 'Отмена' }).click();
  await expect(card).toHaveClass(/selected/);
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Delete');
  await expect(card).toBeVisible();
  expect((await getBoard(request, owner, campaignId)).cards).toHaveLength(1);
});
