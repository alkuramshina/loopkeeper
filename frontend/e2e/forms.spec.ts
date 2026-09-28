import { expect, Page, test } from './support/test';
import {
  createCampaignWithRoles,
  createElement,
  getBoard,
  signInAs,
} from './support/api';

async function position(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`${selector} is not visible`);
  return { x: box.x, y: box.y };
}

test('a dialog closes by the cross, Escape and a click outside without moving the page', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  await createElement(request, owner, campaignId, {
    type: 'NOTE',
    title: 'Старая заметка',
  });
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/elements`);
  await expect(
    page.getByRole('link', { name: /Старая заметка/ }),
  ).toBeVisible();
  const before = await position(page, '.materials-row');

  const opener = page.getByRole('button', { name: 'Материал', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Новый материал' });
  const closeWays: [string, () => Promise<void>][] = [
    ['cross', () => dialog.getByRole('button', { name: 'Закрыть' }).click()],
    ['Escape', () => page.keyboard.press('Escape')],
    // The backdrop fills the viewport; its top-left corner is outside the dialog.
    ['outside', () => page.mouse.click(5, 5)],
  ];
  for (const [way, close] of closeWays) {
    await opener.click();
    await expect(dialog, way).toBeVisible();
    // Opening a dialog does not push the page content.
    expect(await position(page, '.materials-row'), way).toEqual(before);
    await close();
    await expect(dialog, way).toHaveCount(0);
    expect(await position(page, '.materials-row'), way).toEqual(before);
  }

  // A click inside the dialog, even on its padding, keeps it open.
  await opener.click();
  const box = await dialog.boundingBox();
  if (!box) throw new Error('Dialog is not visible');
  await page.mouse.click(box.x + 4, box.y + box.height - 4);
  await expect(dialog).toBeVisible();
});

test('a player creates a character through the form; the NPC form has its own fields', async ({
  browser,
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);

  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/characters`);
  // Without a character the form is already open; only the name, age and
  // type are required, and a single template is not offered as a choice.
  const form = page.getByRole('form', { name: 'Новый персонаж' });
  await expect(form.getByLabel('Шаблон')).toHaveCount(0);
  await form.getByLabel('Имя').fill('Ольга');
  await form.getByRole('button', { name: 'Создать персонажа' }).click();
  await expect(form.getByLabel('Возраст')).toBeFocused();
  await form.getByLabel('Возраст').fill('12');
  await form.getByLabel('Тип').selectOption({ label: 'Книголюб' });
  await form.getByRole('button', { name: 'Создать персонажа' }).click();
  await expect(form).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Ольга' })).toBeVisible();
  await expect(
    page.getByText('Книголюб · 12 лет · играет Игрок').first(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Создать персонажа' }),
  ).toHaveCount(0);

  // The master creates an NPC: a catalog element with NPC fields, no character
  // profile sections, and the type is called «NPC».
  const context = await browser.newContext();
  const ownerPage = await context.newPage();
  await signInAs(ownerPage, owner);
  await ownerPage.goto(`/campaigns/${campaignId}/elements`);
  await ownerPage
    .getByRole('button', { name: 'Материал', exact: true })
    .first()
    .click();
  const npcDialog = ownerPage.getByRole('dialog', { name: 'Новый материал' });
  const type = npcDialog.getByLabel('Тип');
  await expect(type.locator('option[value="NPC"]')).toHaveText('NPC');
  await type.selectOption('NPC');
  await expect(npcDialog.locator('fieldset, legend')).toHaveCount(0);
  await expect(npcDialog).not.toContainText('Profile');
  // The role is required up front; the rest is written right after.
  await npcDialog.getByLabel('Название').fill('Сторож Берг');
  await npcDialog.getByLabel('Роль', { exact: true }).fill('Сторож');
  await npcDialog.getByRole('button', { name: 'Создать' }).click();
  const npc = ownerPage.getByRole('article');
  for (const label of [
    'Роль',
    'Мотивация',
    'Первое впечатление',
    'Секрет',
    'Связи',
  ])
    await expect(npc.getByLabel(label, { exact: true })).toBeVisible();
  await npc.getByLabel('Мотивация', { exact: true }).fill('Хранит тайну');
  await expect(npc.getByRole('status')).toHaveText('Сохранено');
  await npc.getByRole('button', { name: 'Готово' }).click();
  await expect(npc.getByRole('heading', { name: 'Сторож Берг' })).toBeVisible();
  await expect(npc.locator('dl')).toContainText('РольСторож');
  await expect(npc.locator('dl')).toContainText('МотивацияХранит тайну');
  await context.close();
});

test('a location form appears only on request and saving opens the new location', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/elements?type=LOCATION`);

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Название')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Материал', exact: true })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: 'Новый материал' });
  await expect(dialog.getByLabel('Тип')).toHaveValue('LOCATION');
  await dialog.getByLabel('Название').fill('Маяк');
  await dialog.getByRole('button', { name: 'Создать' }).click();

  await expect(page).toHaveURL(
    new RegExp(`/campaigns/${campaignId}/elements/[0-9a-f-]+$`),
  );
  await expect(page.getByRole('article').getByLabel('Название')).toHaveValue(
    'Маяк',
  );
});

test('a new card stays on the board when its position cannot be saved', async ({
  page,
  request,
}) => {
  const { campaignId, player } = await createCampaignWithRoles(request);
  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/board`);

  await page.route('**/api/investigation-board/nodes/*', (route) =>
    route.abort('connectionrefused'),
  );
  await page.getByRole('button', { name: 'Новая карточка' }).click();
  await page.getByLabel('Название карточки').fill('Без позиции');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  const card = page.locator('.react-flow__node', { hasText: 'Без позиции' });
  await expect(card).toBeVisible();

  await page.unroute('**/api/investigation-board/nodes/*');
  await page.getByRole('button', { name: 'Обновить' }).click();
  await expect(card).toBeVisible();
  await page.reload();
  await expect(card).toBeVisible();
  const board = await getBoard(request, player, campaignId);
  expect(board.cards.map((item) => item.title)).toEqual(['Без позиции']);
});

test('the tag composer refuses empty, repeated, overlong and extra tags; colour and icon are optional', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/board`);

  await page.getByRole('button', { name: 'Новая карточка' }).click();
  await page.getByLabel('Название карточки').fill('Много тегов');
  const input = page.getByRole('textbox', { name: 'Новый тег' });
  const chips = page.locator('.tag-composer-list .tag-chip');
  const add = async (value: string) => {
    await input.fill(value);
    await input.press('Enter');
  };

  await add('   ');
  await add('#');
  await expect(chips).toHaveCount(0);

  // The field stops at 50 characters, so a longer tag cannot be entered.
  await input.fill('д'.repeat(60));
  await expect(input).toHaveValue('д'.repeat(50));
  await input.press('Enter');
  await expect(chips).toHaveCount(1);

  await add('улика');
  await add('#улика');
  await expect(chips).toHaveCount(2);

  for (let index = 3; index <= 31; index += 1) await add(`тег${index}`);
  await expect(chips).toHaveCount(30);
  await expect(input).toHaveValue('тег31');

  // A chip click removes the tag.
  await page.getByRole('button', { name: '#улика ×' }).click();
  await expect(chips).toHaveCount(29);

  // Colour and icon stay «Не выбрано».
  await expect(page.getByLabel('Цвет карточки')).toHaveValue('');
  await expect(page.getByLabel('Иконка карточки')).toHaveValue('');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(
    page.locator('.react-flow__node', { hasText: 'Много тегов' }),
  ).toBeVisible();

  const response = await request.get(
    `/api/campaigns/${campaignId}/investigation-board`,
    { headers: owner.headers },
  );
  const board = (await response.json()) as {
    cards: Array<{ tags: string[]; color: string | null; icon: string | null }>;
  };
  expect(board.cards[0].tags).toHaveLength(29);
  expect(board.cards[0].tags).toContain('д'.repeat(50));
  expect(board.cards[0].tags).not.toContain('улика');
  expect(board.cards[0].color ?? null).toBeNull();
  expect(board.cards[0].icon ?? null).toBeNull();

  // Both can be chosen and are stored.
  await page
    .locator('.react-flow__node', { hasText: 'Много тегов' })
    .locator('h3')
    .click();
  await page.getByLabel('Цвет карточки').selectOption('blue');
  await page.getByLabel('Иконка карточки').selectOption({ label: 'Улика' });
  const saved = page.waitForResponse(
    (item) =>
      item.request().method() === 'PATCH' && item.url().includes('/cards/'),
  );
  await page.getByRole('button', { name: 'Сохранить' }).click();
  expect((await saved).ok()).toBeTruthy();
  const updated = (await (
    await request.get(`/api/campaigns/${campaignId}/investigation-board`, {
      headers: owner.headers,
    })
  ).json()) as { cards: Array<{ color: string; icon: string }> };
  expect(updated.cards[0]).toMatchObject({ color: 'blue', icon: 'clue' });
});
