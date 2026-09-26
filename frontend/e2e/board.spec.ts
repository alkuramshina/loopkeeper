import { expect, Locator, Page, test } from '@playwright/test';
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
  await page.getByLabel('Цвет карточки').selectOption('#39726a');
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
  expect(board.cards[0]).toMatchObject({ title: 'Следы на снегу', tags: ['улика'] });
});

test('M6: a player drags, resizes and links cards; the layout persists', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  const radioId = await createFreeCard(request, owner, campaignId, 'Радиосигнал', {
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
  await expect(radio).toBeVisible();
  await expect(farm).toBeVisible();

  // Drag: the saved node moves down, the other card keeps its place.
  const dragged = nodeSaved(page);
  await dragBy(page, radio.locator('h3'), 0, 150);
  await dragged;
  let board = await getBoard(request, player, campaignId);
  const movedNode = board.cards.find((card) => card.cardId === radioId)?.node;
  expect(movedNode?.y).toBeGreaterThan(50);
  expect(Math.abs(movedNode?.x ?? 999)).toBeLessThan(20);

  // Resize: selecting the card shows the resizer; the saved width grows.
  await radio.locator('h3').click();
  await page.getByRole('button', { name: 'Отмена' }).click();
  const resized = nodeSaved(page);
  await dragBy(page, radio.locator('.react-flow__resize-control.handle.bottom.right'), 80, 40);
  await resized;
  board = await getBoard(request, player, campaignId);
  const resizedNode = board.cards.find((card) => card.cardId === radioId)?.node;
  expect(resizedNode?.width).toBeGreaterThan(260);

  // Link: drag from the source handle of one card to the target handle of the
  // other. Links are undirected; the moved card's bottom handle is off-canvas.
  const linked = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/investigation-links') &&
      response.ok(),
  );
  await farm.scrollIntoViewIfNeeded();
  const source = await farm.locator('.react-flow__handle-bottom').boundingBox();
  const target = await radio.locator('.react-flow__handle-top').boundingBox();
  if (!source || !target) throw new Error('Handles are not visible');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, {
    steps: 10,
  });
  await page.mouse.up();
  await linked;

  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(boardCard(page, 'Радиосигнал')).toHaveCount(1);

  board = await getBoard(request, player, campaignId);
  expect(board.links).toHaveLength(1);
  expect(board.cards.find((card) => card.cardId === radioId)?.node).toMatchObject({
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
    if (outgoing.url().includes('/api/investigation-board/nodes/')) nodeUpdates += 1;
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
