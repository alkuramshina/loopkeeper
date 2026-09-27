import { expect, test } from './support/test';
import {
  createCampaignWithRoles,
  createFreeCard,
  getBoard,
  signInAs,
} from './support/api';

test('F13c: search and inspector expose card context; removal can be undone', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  await createFreeCard(request, owner, campaignId, 'Радиосигнал', {
    x: 0,
    y: 0,
  });
  await createFreeCard(request, owner, campaignId, 'Заброшенная ферма', {
    x: 600,
    y: 0,
  });
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/board`);

  const radio = page.locator('.react-flow__node', { hasText: 'Радиосигнал' });
  const farm = page.locator('.react-flow__node', {
    hasText: 'Заброшенная ферма',
  });
  await page.getByRole('textbox', { name: 'Найти на доске' }).fill('радио');
  await expect(radio).not.toHaveClass(/board-node-dimmed/);
  await expect(farm).toHaveClass(/board-node-dimmed/);
  await page.getByRole('textbox', { name: 'Найти на доске' }).fill('');

  await radio.locator('h3').click();
  const inspector = page.getByRole('complementary', {
    name: 'Редактирование карточки',
  });
  await expect(inspector).toBeVisible();
  const canvasBox = await page.locator('.board-canvas').boundingBox();
  const inspectorBox = await inspector.boundingBox();
  if (!canvasBox || !inspectorBox)
    throw new Error('Board layout is unavailable');
  expect(inspectorBox.x).toBeGreaterThanOrEqual(
    canvasBox.x + canvasBox.width - 2,
  );
  await inspector.getByRole('button', { name: 'Убрать с доски' }).click();
  await expect(page.getByRole('button', { name: 'Отменить' })).toBeVisible();
  await page.getByRole('button', { name: 'Отменить' }).click();
  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect(radio).toBeVisible();
  expect((await getBoard(request, owner, campaignId)).cards).toHaveLength(2);
});

test('F13c: phone board is read only and creates a card in a bottom sheet', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  await createFreeCard(request, owner, campaignId, 'Радиосигнал', {
    x: 0,
    y: 0,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/board`);

  const card = page.locator('.react-flow__node', { hasText: 'Радиосигнал' });
  await expect(card).toBeVisible();
  await expect(card).not.toHaveClass(/draggable/);
  await card.locator('h3').click();
  await expect(
    page.getByRole('complementary', { name: 'Редактирование карточки' }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Связать' })).toBeHidden();
  await page.getByRole('button', { name: 'Новая карточка' }).click();
  const inspector = page.getByRole('complementary', { name: 'Новая карточка' });
  await expect(inspector).toBeVisible();
  const box = await inspector.boundingBox();
  const navBox = await page
    .locator('.campaign-workspace-shell-mobile-navigation')
    .boundingBox();
  if (!box || !navBox) throw new Error('Mobile layout is unavailable');
  expect(Math.abs(box.y + box.height - navBox.y)).toBeLessThan(16);
  await inspector.getByLabel('Название карточки').fill('Следы на снегу');
  await inspector.getByRole('button', { name: 'Сохранить' }).click();
  await expect(
    page.locator('.react-flow__node', { hasText: 'Следы на снегу' }),
  ).toBeVisible();
});
