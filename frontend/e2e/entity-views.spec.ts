import { expect, test } from './support/test';
type BoardSnapshot = { cards: Array<{ cardId: string; isNew: boolean }> };
import {
  createCampaignWithRoles,
  createElement,
  createFreeCard,
  signInAs,
} from './support/api';

test('B4: unviewed materials survive visits and list reads; opening each route saves views and updates counts', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  const clue = await createElement(request, owner, campaignId, {
    type: 'NOTE',
    title: 'Новая улика',
    access: 'SHARED',
  });
  const ownNote = await createElement(request, player, campaignId, {
    type: 'NOTE',
    title: 'Моя заметка',
    access: 'PRIVATE',
  });
  for (let i = 0; i < 3; i++)
    await request.post(`/api/campaigns/${campaignId}/visit`, {
      headers: player.headers,
    });
  await signInAs(page, player);
  await page.goto('/campaigns');
  await expect(
    page.getByRole('link', { name: /Непросмотренные материалы и заметки: 1/ }),
  ).toHaveAttribute('href', `/campaigns/${campaignId}/case`);
  await page.goto(`/campaigns/${campaignId}/case`);
  await expect(
    page.getByRole('region', { name: 'Непросмотренное' }),
  ).toContainText('Новая улика');
  expect(
    (
      await (
        await request.get(`/api/elements/${clue}`, { headers: player.headers })
      ).json()
    ).isNew,
  ).toBe(true);
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/campaigns/${campaignId}/views`) &&
      response.status() === 204,
  );
  await page.getByRole('link', { name: /Новая улика/ }).click();
  await saved;
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(`/api/campaigns/${campaignId}`, {
              headers: player.headers,
            })
          ).json()
        ).newVisibleMaterialCount,
    )
    .toBe(0);
  await page.goto(`/campaigns/${campaignId}/case`);
  await expect(
    page.getByRole('heading', { name: 'Дело', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Непросмотренное' }),
  ).toHaveCount(0);
  for (const path of [`elements/${clue}`, `notes/${ownNote}`]) {
    const viewed = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/campaigns/${campaignId}/views`) &&
        response.status() === 204,
    );
    await page.goto(`/campaigns/${campaignId}/${path}`);
    await viewed;
  }
});

test('B4: a master sees an unviewed player note and its access on desktop and phone', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  const note = await createElement(request, player, campaignId, {
    type: 'NOTE',
    title: 'Записка мастеру',
    access: 'MASTER_ONLY',
  });
  await signInAs(page, owner);
  await page.goto('/campaigns');
  await expect(
    page.getByRole('link', { name: /Непросмотренные материалы и заметки: 1/ }),
  ).toHaveAttribute('href', `/campaigns/${campaignId}/elements`);
  for (const width of [1440, 320, 768]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`/campaigns/${campaignId}/elements`);
    const row = page.locator('.materials-row', { hasText: 'Записка мастеру' });
    await expect(row.locator('.ui-new-mark')).toBeVisible();
    await expect(row.locator('.ui-access')).toContainText('Мастеру');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/b4-materials-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.materials-row', { hasText: 'Записка мастеру' }).click();
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(`/api/elements/${note}`, {
              headers: owner.headers,
            })
          ).json()
        ).isNew,
    )
    .toBe(false);
});

test('B4: board views preserve the displayed snapshot through mutations, refresh resets it, previews do not consume sources', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  const source = await createElement(request, owner, campaignId, {
    type: 'NOTE',
    title: 'Источник',
    access: 'SHARED',
  });
  const own = await createFreeCard(
    request,
    player,
    campaignId,
    'Моя карточка',
    { x: 80, y: 80 },
  );
  const other = await createFreeCard(
    request,
    owner,
    campaignId,
    'Чужая карточка',
    { x: 380, y: 80 },
  );
  await request.post(`/api/campaigns/${campaignId}/investigation-links`, {
    headers: owner.headers,
    data: { cardAId: own, cardBId: other },
  });
  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/case`);
  await expect(
    page.getByRole('heading', { name: 'Дело', exact: true }),
  ).toBeVisible();
  // The background board query on the case cannot consume views.
  expect(
    (
      (await (
        await request.get(`/api/campaigns/${campaignId}/investigation-board`, {
          headers: player.headers,
        })
      ).json()) as BoardSnapshot
    ).cards.find((c: BoardSnapshot['cards'][number]) => c.cardId === other)
      ?.isNew,
  ).toBe(true);
  await page.goto(`/campaigns/${campaignId}/board`);
  const card = page.locator('.react-flow__node', { hasText: 'Чужая карточка' });
  await expect(card).toContainText('Непросмотренное');
  await expect(page.locator('.react-flow__edge.board-edge-new')).toHaveCount(1);
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(
              `/api/campaigns/${campaignId}/investigation-board`,
              { headers: player.headers },
            )
          ).json()
        ).cards.find((c: BoardSnapshot['cards'][number]) => c.cardId === other)
          ?.isNew,
    )
    .toBe(false);
  expect(
    (
      await (
        await request.get(`/api/elements/${source}`, {
          headers: player.headers,
        })
      ).json()
    ).isNew,
  ).toBe(true);
  await card.click();
  await page.getByLabel('Название').fill('Изменённая карточка');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(
    page.locator('.react-flow__node', { hasText: 'Изменённая карточка' }),
  ).toContainText('Непросмотренное');
  const refresh = page.getByRole('button', { name: 'Обновить', exact: true });
  await refresh.focus();
  await expect(page.locator('#board-refresh-hint')).toBeVisible();
  await refresh.click();
  await expect(page.locator('.react-flow__edge.board-edge-new')).toHaveCount(0);
  await expect(
    page.locator('.react-flow__node', { hasText: 'Изменённая карточка' }),
  ).not.toContainText('Непросмотренное');
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(page.locator('#campaign-sidebar')).not.toBeInViewport();
  await expect(page.locator('#board-refresh-hint')).toBeVisible();
  await page.screenshot({ path: 'test-results/b4-board-320.png' });
  await page.goto(`/campaigns/${campaignId}/case`);
  await expect(
    page.getByRole('heading', { name: 'Дело', exact: true }),
  ).toBeVisible();
  await page.goto(`/campaigns/${campaignId}/board`);
  await expect(
    page.locator('.react-flow__node', { hasText: 'Изменённая карточка' }),
  ).not.toContainText('Непросмотренное');
});

test('B4: an element keeps its content and mark through failed saves and a manual retry', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  const clue = await createElement(request, owner, campaignId, {
    type: 'NOTE',
    title: 'Сетевая улика',
    content: 'Сохранённое содержимое',
    access: 'SHARED',
  });
  let attempts = 0;
  await page.route(`**/campaigns/${campaignId}/views`, async (route) => {
    attempts++;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 503,
        code: 'internal.error',
        message: 'Unavailable',
      }),
    });
  });
  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/case/${clue}`);
  await expect(page.getByText('Не удалось сохранить просмотр')).toBeVisible();
  expect(attempts).toBe(2);
  await expect(page.getByText('Сохранённое содержимое')).toBeVisible();
  await expect(page.locator('.material-detail > .ui-new-mark')).toBeVisible();
  await page.unroute(`**/campaigns/${campaignId}/views`);
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(page.getByText('Не удалось сохранить просмотр')).toHaveCount(0);
  await expect(page.locator('.material-detail > .ui-new-mark')).toHaveCount(0);
});

test('B4: a viewer recovers a deleted board ID and records late cards in their own rendered batch', async ({
  page,
  request,
}) => {
  const { campaignId, owner, viewer } = await createCampaignWithRoles(request);
  const removed = await createFreeCard(
    request,
    owner,
    campaignId,
    'Удаляемая карточка',
    { x: 80, y: 80 },
  );
  const retained = await createFreeCard(
    request,
    owner,
    campaignId,
    'Оставшаяся карточка',
    { x: 380, y: 80 },
  );
  let late = '';
  const batches: Array<Array<{ entityId: string }>> = [];
  await page.route(`**/campaigns/${campaignId}/views`, async (route) => {
    const entities = route.request().postDataJSON().entities;
    batches.push(entities);
    if (batches.length === 1) {
      expect(
        (
          await request.delete(`/api/cards/${removed}`, {
            headers: owner.headers,
          })
        ).ok(),
      ).toBe(true);
      late = await createFreeCard(
        request,
        owner,
        campaignId,
        'Поздняя карточка',
        { x: 680, y: 80 },
      );
    }
    await route.continue();
  });
  await signInAs(page, viewer);
  await page.goto(`/campaigns/${campaignId}/board`);
  await expect(
    page.locator('.react-flow__node', { hasText: 'Поздняя карточка' }),
  ).toContainText('Непросмотренное');
  await expect(
    page.locator('.react-flow__node', { hasText: 'Удаляемая карточка' }),
  ).toHaveCount(0);
  await expect
    .poll(async () => {
      const board = await (
        await request.get(`/api/campaigns/${campaignId}/investigation-board`, {
          headers: viewer.headers,
        })
      ).json();
      return board.cards.every(
        (card: BoardSnapshot['cards'][number]) => !card.isNew,
      );
    })
    .toBe(true);
  expect(batches[0].map((entity) => entity.entityId)).toEqual(
    expect.arrayContaining([removed, retained]),
  );
  expect(batches[0].some((entity) => entity.entityId === late)).toBe(false);
  expect(
    batches.some(
      (batch) => batch.length === 1 && batch[0].entityId === retained,
    ),
  ).toBe(true);
  expect(
    batches.some((batch) => batch.length === 1 && batch[0].entityId === late),
  ).toBe(true);
});

test('B4: deleted material becomes unavailable after a view 404', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  const clue = await createElement(request, owner, campaignId, {
    type: 'NOTE',
    title: 'Исчезающая улика',
    access: 'SHARED',
  });
  await page.route(`**/campaigns/${campaignId}/views`, async (route) => {
    await request.delete(`/api/elements/${clue}`, { headers: owner.headers });
    await route.continue();
  });
  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/case/${clue}`);
  await expect(
    page.getByRole('heading', { name: 'Страница недоступна' }),
  ).toBeVisible();
  await expect(page.locator('.material-detail')).toHaveCount(0);
});
