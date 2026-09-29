import { expect, test } from './support/test';
import {
  createCampaignWithRoles,
  createFreeCard,
  registerUser,
  signInAs,
  createElement,
  getBoard,
  openAs,
} from './support/api';

const sidebar = '.campaign-workspace-shell-navigation';

test('M5: a viewer reads the board and catalog without editing controls', async ({
  page,
  request,
}) => {
  const { campaignId, owner, viewer } = await createCampaignWithRoles(request);
  await createFreeCard(request, owner, campaignId, 'Сломанный робот', {
    x: 100,
    y: 100,
  });

  await signInAs(page, viewer);
  await page.goto(`/campaigns/${campaignId}`);

  const navigation = page.locator(sidebar);
  await expect(navigation.getByRole('link')).toHaveText([
    'Доска расследования',
    'Дело',
    'Персонажи',
  ]);

  await navigation.getByRole('link', { name: 'Доска расследования' }).click();
  await expect(page.getByText(/^Режим просмотра/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Новая карточка' }),
  ).toHaveCount(0);
  const card = page.locator('.react-flow__node', {
    hasText: 'Сломанный робот',
  });
  await expect(card).toBeVisible();

  // Clicking a card must not open the inspector for a viewer. The read-only
  // canvas takes the pointer, so click by coordinates like a user would.
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  if (!box) throw new Error('Card is not visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(
    page.getByRole('heading', { name: 'Редактирование карточки' }),
  ).toHaveCount(0);

  await navigation.getByRole('link', { name: 'Дело' }).click();
  await expect(
    page.getByRole('heading', { name: 'Дело', exact: true }),
  ).toBeVisible();
  for (const name of ['Материал', 'Заметка'])
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(
      0,
    );
  await expect(page.getByRole('form', { name: 'Быстрая заметка' })).toHaveCount(
    0,
  );

  for (const section of ['members', 'settings']) {
    await page.goto(`/campaigns/${campaignId}/${section}`);
    await expect(page.getByRole('alert')).toHaveText('Ресурс недоступен.');
    await expect(page.locator(sidebar)).toHaveCount(0);
  }
});

test('an outsider gets the neutral unavailable state on a direct board URL', async ({
  page,
  request,
}) => {
  const { campaignId } = await createCampaignWithRoles(request);
  const outsider = await registerUser(request, 'Посторонний');

  await signInAs(page, outsider);
  await page.goto(`/campaigns/${campaignId}/board`);

  await expect(page.getByRole('alert')).toHaveText('Этот ресурс недоступен.');
  await expect(page.locator('.react-flow')).toHaveCount(0);
});

test('the owner sees members and campaign settings in the navigation', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);

  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}`);

  await expect(page.locator(sidebar).getByRole('link')).toHaveText([
    'Доска',
    'Материалы',
    'Персонажи',
  ]);
  // Members and invitations are two screens in a «Участники» submenu that
  // opens on a click.
  const people = page
    .locator(sidebar)
    .getByRole('button', { name: 'Участники' });
  await expect(people).toHaveAttribute('aria-expanded', 'false');
  await people.click();
  await expect(people).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page
      .locator(sidebar)
      .getByRole('group', { name: 'Участники' })
      .getByRole('link'),
  ).toHaveText(['Состав', 'Приглашения']);
  // Campaign settings are three screens in a «Настройки» submenu.
  await page
    .locator(sidebar)
    .getByRole('button', { name: 'Настройки' })
    .click();
  await expect(
    page
      .locator(sidebar)
      .getByRole('group', { name: 'Настройки' })
      .getByRole('link'),
  ).toHaveText(['Сведения', 'Обложка', 'Удаление']);
});

test('a viewer sees the board with its links but cannot change anything', async ({
  page,
  request,
}) => {
  const { campaignId, owner, viewer } = await createCampaignWithRoles(request);
  const first = await createFreeCard(request, owner, campaignId, 'Робот', {
    x: 0,
    y: 0,
  });
  const second = await createFreeCard(request, owner, campaignId, 'Ферма', {
    x: 500,
    y: 0,
  });
  await request.post(`/api/campaigns/${campaignId}/investigation-links`, {
    headers: owner.headers,
    data: { cardAId: first, cardBId: second, label: 'след' },
  });

  const mutations: string[] = [];
  page.on('request', (outgoing) => {
    // Session refreshes and visit recording are not board changes.
    if (
      outgoing.method() !== 'GET' &&
      !outgoing.url().includes('/api/auth/') &&
      !outgoing.url().endsWith('/visit')
    )
      mutations.push(`${outgoing.method()} ${outgoing.url()}`);
  });
  await signInAs(page, viewer);
  await page.goto(`/campaigns/${campaignId}/board`);
  mutations.length = 0;

  await expect(page.getByText(/^Режим просмотра/)).toBeVisible();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toContainText('след');

  const robot = page.locator('.react-flow__node', { hasText: 'Робот' });
  const farm = page.locator('.react-flow__node', { hasText: 'Ферма' });
  await robot.scrollIntoViewIfNeeded();
  const before = await robot.boundingBox();
  // The canvas itself may pan; the card must keep its place on the board.
  const boardPosition = () =>
    robot.evaluate((node) => (node as HTMLElement).style.transform);
  const placed = await boardPosition();

  // Drag, resize handles, connecting and keyboard deletion do nothing. The
  // read-only canvas takes the pointer, so act by coordinates like a user.
  await page.mouse.move((before?.x ?? 0) + 20, (before?.y ?? 0) + 20);
  await page.mouse.down();
  await page.mouse.move((before?.x ?? 0) + 60, (before?.y ?? 0) + 200, {
    steps: 5,
  });
  await page.mouse.up();
  expect(await boardPosition()).toBe(placed);
  await expect(page.locator('.react-flow__resize-control')).toHaveCount(0);

  const source = await farm.locator('.react-flow__handle-bottom').boundingBox();
  const target = await robot.locator('.react-flow__handle-top').boundingBox();
  if (!source || !target) throw new Error('Handles are not visible');
  await page.mouse.move(source.x + 2, source.y + 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 2, target.y + 2, { steps: 10 });
  await page.mouse.up();

  await page.mouse.click((before?.x ?? 0) + 20, (before?.y ?? 0) + 20);
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Delete');
  await expect(
    page.getByRole('heading', { name: 'Редактирование карточки' }),
  ).toHaveCount(0);
  await expect(robot).toBeVisible();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  expect(mutations).toEqual([]);
  expect((await getBoard(request, owner, campaignId)).links).toHaveLength(1);
});

test('a player demoted to viewer loses their private notes but keeps reading shared ones', async ({
  browser,
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  await createElement(request, player, campaignId, {
    type: 'NOTE',
    title: 'Личное подозрение',
  });
  await createElement(request, player, campaignId, {
    type: 'NOTE',
    title: 'Общая находка',
    access: 'SHARED',
  });
  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/notes`);
  await expect(page.locator('.note-row-title')).toHaveText([
    'Общая находка',
    'Личное подозрение',
  ]);

  const ownerPage = await openAs(
    browser,
    owner,
    `/campaigns/${campaignId}/members`,
  );
  const demoted = ownerPage.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().includes('/members/') &&
      response.ok(),
  );
  await ownerPage.getByLabel('Роль для Игрок').selectOption('VIEWER');
  await demoted;

  // A viewer has no notes screen; the shared note stays readable in the case.
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/campaigns/${campaignId}/case$`));
  const items = page.locator('.case-card-title, .case-row-title');
  await expect(items).toHaveText(['Общая находка']);
  await items.first().click();
  const detail = page.getByRole('article');
  await expect(
    detail.getByRole('heading', { name: 'Общая находка' }),
  ).toBeVisible();
  for (const name of ['Изменить', 'Ещё действия'])
    await expect(detail.getByRole('button', { name })).toHaveCount(0);
  await expect(
    detail.getByRole('radiogroup', { name: 'Кто видит' }),
  ).toHaveCount(0);
  for (const name of ['Заметка', 'Добавить на доску'])
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(
      0,
    );
});
