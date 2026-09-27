import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from './support/test';
import {
  addMember,
  createCampaign,
  createCampaignWithRoles,
  createElement,
  createFreeCard,
  createPlayerCharacter,
  listCampaignTitles,
  listElementTitles,
  registerUser,
  signInAs,
  TestUser,
} from './support/api';

async function expectNoAxeViolations(page: Page, where: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Colours belong to the design system that is still being finalised;
    // contrast is checked manually per theme (see DESIGN.md).
    .disableRules(['color-contrast'])
    .analyze();
  const violations = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(' '))
        .join(', ')}`,
  );
  expect(violations, `${where}: axe violations`).toEqual([]);
}

function focusedInsideDialog(page: Page) {
  return page.evaluate(() =>
    Boolean(document.activeElement?.closest('dialog[open]')),
  );
}

test('a dialog takes focus, closes with Escape and returns focus to its opener', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/elements`);

  const opener = page.getByRole('button', { name: 'Новый элемент' });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Новый элемент' });
  await expect(dialog).toBeVisible();
  expect(await focusedInsideDialog(page)).toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();

  // The close button returns focus as well.
  await page.keyboard.press('Enter');
  await dialog.getByRole('button', { name: 'Закрыть' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('a campaign element is created with the keyboard only; errors are announced', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/elements`);

  await page.getByRole('button', { name: 'Новый элемент' }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Новый элемент' });

  // Tab order follows the visual order: close, type, access, title.
  await expect(dialog.getByRole('button', { name: 'Закрыть' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByLabel('Тип')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByLabel('Доступ')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByLabel('Название')).toBeFocused();
  await page.keyboard.type('Письмо без подписи');

  // A failed save is announced through role=alert and keeps the dialog open.
  await page.route('**/api/campaigns/*/elements', (route) =>
    route.request().method() === 'POST'
      ? route.abort('connectionrefused')
      : route.fallback(),
  );
  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog).toBeVisible();

  await page.unroute('**/api/campaigns/*/elements');
  await dialog.getByLabel('Название').focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Письмо без подписи' }),
  ).toBeVisible();
  expect(await listElementTitles(request, owner, campaignId)).toContain(
    'Письмо без подписи',
  );
});

test('main screens have no automatically detectable accessibility violations', async ({
  page,
  request,
}) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();
  await expectNoAxeViolations(page, 'sign-in');

  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  await createPlayerCharacter(request, player, campaignId, 'Ольга');
  const elementId = await createElement(request, owner, campaignId, {
    type: 'LOCATION',
    title: 'Старая вышка',
    access: 'SHARED',
  });
  await createFreeCard(request, owner, campaignId, 'Радиосигнал', {
    x: 0,
    y: 0,
  });
  await signInAs(page, owner);

  const screens: [string, string, string][] = [
    ['campaigns', '/campaigns', 'Кампании'],
    ['characters', `/campaigns/${campaignId}/characters`, 'Ольга'],
    ['elements', `/campaigns/${campaignId}/elements`, 'Старая вышка'],
    [
      'element detail',
      `/campaigns/${campaignId}/elements/${elementId}`,
      'Старая вышка',
    ],
    ['board', `/campaigns/${campaignId}/board`, 'Радиосигнал'],
    ['members', `/campaigns/${campaignId}/members`, 'Мастер'],
    ['campaign settings', `/campaigns/${campaignId}/settings`, 'Настройки'],
    ['account', '/settings/account', 'Аккаунт'],
  ];
  for (const [where, path, marker] of screens) {
    await page.goto(path);
    await expect(page.getByText(marker).first()).toBeVisible();
    await expectNoAxeViolations(page, where);
  }
});

/** Tabs through the page and checks every stop: visible focus, DOM order. */
async function expectKeyboardWalk(page: Page, where: string, stops = 40) {
  await expect(
    page.locator('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])'),
    `${where}: positive tabindex breaks the natural order`,
  ).toHaveCount(0);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  let previous = -1;
  for (let step = 0; step < stops; step += 1) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      const style = getComputedStyle(element);
      const outline =
        style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
      const label =
        element.getAttribute('aria-label') ?? element.textContent ?? '';
      return {
        name: `${element.tagName.toLowerCase()} "${label.trim().slice(0, 30)}"`,
        visible: outline || style.boxShadow !== 'none',
        index: [...document.querySelectorAll('*')].indexOf(element),
      };
    });
    // Leaving the document (browser UI) ends the walk.
    if (!stop) break;
    expect(stop.visible, `${where}: no visible focus on ${stop.name}`).toBe(
      true,
    );
    // Wrapping back to the top ends the walk; otherwise order only grows.
    if (stop.index < previous) break;
    previous = stop.index;
  }
}

test('every dialog is named, keeps focus inside, closes with Escape and returns focus', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  const secondPlayer = await registerUser(request, 'Второй игрок');
  await addMember(request, owner, campaignId, secondPlayer, 'PLAYER');
  await createPlayerCharacter(request, player, campaignId, 'Ольга');
  const elementId = await createElement(request, owner, campaignId, {
    type: 'NOTE',
    title: 'Заметка',
  });

  const dialogs: [TestUser, string, string, string][] = [
    [owner, '/campaigns', 'Новая кампания', 'Новая кампания'],
    [
      owner,
      `/campaigns/${campaignId}/elements/${elementId}`,
      'Редактировать',
      'Редактирование элемента',
    ],
    [
      owner,
      `/campaigns/${campaignId}/members`,
      'Создать приглашение',
      'Создать приглашение',
    ],
    [
      player,
      `/campaigns/${campaignId}/characters`,
      'Редактировать',
      'Редактирование персонажа',
    ],
    [
      secondPlayer,
      `/campaigns/${campaignId}/characters`,
      'Создать персонажа',
      'Новый персонаж',
    ],
  ];
  for (const [user, path, openerName, title] of dialogs) {
    await signInAs(page, user);
    await page.goto(path);
    const opener = page.getByRole('button', { name: openerName }).first();
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: title });
    await expect(dialog, title).toBeVisible();
    expect(await focusedInsideDialog(page), title).toBe(true);

    for (let step = 0; step < 60; step += 1) {
      await page.keyboard.press('Tab');
      const outside = await page.evaluate(
        () =>
          document.activeElement !== document.body &&
          !document.activeElement?.closest('dialog[open]'),
      );
      expect(outside, `${title}: focus left the dialog`).toBe(false);
    }
    await page.keyboard.press('Escape');
    await expect(dialog, title).toHaveCount(0);
    await expect(opener, title).toBeFocused();
  }
});

test('every screen and dialog has a visible focus in document order', async ({
  page,
  request,
}) => {
  await page.goto('/sign-in');
  await expectKeyboardWalk(page, 'sign-in');
  await page.goto('/sign-up');
  await expectKeyboardWalk(page, 'sign-up');

  const { campaignId, owner } = await createCampaignWithRoles(request);
  const elementId = await createElement(request, owner, campaignId, {
    type: 'LOCATION',
    title: 'Маяк',
    access: 'SHARED',
  });
  await createFreeCard(request, owner, campaignId, 'Радиосигнал', {
    x: 0,
    y: 0,
  });
  await signInAs(page, owner);
  for (const path of [
    '/campaigns',
    `/campaigns/${campaignId}/characters`,
    `/campaigns/${campaignId}/elements/${elementId}`,
    `/campaigns/${campaignId}/board`,
    `/campaigns/${campaignId}/members`,
    `/campaigns/${campaignId}/settings`,
    `/campaigns/${campaignId}/settings/backgrounds`,
    '/settings/account',
  ]) {
    await page.goto(path);
    await expect(page.getByText('Загрузка…')).toHaveCount(0);
    await expectKeyboardWalk(page, path);
  }

  await page.goto(`/campaigns/${campaignId}/elements/${elementId}`);
  await page.getByRole('button', { name: 'Редактировать' }).click();
  await expectKeyboardWalk(page, 'element dialog');
  await page.keyboard.press('Escape');

  await page.goto(`/campaigns/${campaignId}/board`);
  await page.getByRole('button', { name: 'Новая карточка' }).click();
  await expectKeyboardWalk(page, 'board inspector');
});

test('the main forms work with the keyboard alone and announce errors', async ({
  page,
  request,
}) => {
  const owner = await registerUser(request, 'Мастер');
  const campaignId = await createCampaign(request, owner, 'Первая');
  await signInAs(page, owner);

  // Campaign: a failed save is announced, the retry creates it.
  await page.goto('/campaigns');
  await page.getByRole('button', { name: 'Новая кампания' }).focus();
  await page.keyboard.press('Enter');
  const campaignDialog = page.getByRole('dialog', { name: 'Новая кампания' });
  await expect(
    campaignDialog.getByRole('button', { name: 'Закрыть' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.type('Вторая');
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowDown');
  await expect(campaignDialog.getByLabel('Игровая система')).not.toHaveValue(
    '',
  );
  await page.keyboard.press('Tab');
  await page.keyboard.type('Описание с клавиатуры.');
  await page.route('**/api/campaigns', (route) =>
    route.request().method() === 'POST'
      ? route.abort('connectionrefused')
      : route.fallback(),
  );
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(campaignDialog.getByRole('alert')).toBeVisible();
  await page.unroute('**/api/campaigns');
  await expect(
    campaignDialog.getByRole('button', { name: 'Создать кампанию' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(campaignDialog).toHaveCount(0);
  expect(await listCampaignTitles(request, owner)).toContain('Вторая');

  // Invitation.
  await page.goto(`/campaigns/${campaignId}/members`);
  await page.getByRole('button', { name: 'Создать приглашение' }).focus();
  await page.keyboard.press('Enter');
  const invitationDialog = page.getByRole('dialog', {
    name: 'Создать приглашение',
  });
  await page.keyboard.press('Tab');
  await expect(invitationDialog.getByLabel('Роль')).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('.created-invitation code')).toContainText(
    '/invitations/',
  );

  // Board card: the inspector takes focus, Enter in the title saves, focus
  // returns to the button that opened it.
  await page.goto(`/campaigns/${campaignId}/board`);
  await page.getByRole('button', { name: 'Новая карточка' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Название карточки')).toBeFocused();
  await page.keyboard.type('Клавиатурная улика');
  await page.keyboard.press('Enter');
  await expect(
    page.locator('.react-flow__node', { hasText: 'Клавиатурная улика' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Новая карточка' }),
  ).toBeFocused();

  // Account: the profile saves with Enter, a password mismatch is announced.
  await page.goto('/settings/account');
  await page.getByLabel('Имя').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Мастер игры');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Сохранено')).toBeVisible();
  await page.getByLabel('Текущий пароль').focus();
  await page.keyboard.type(owner.password);
  await page.keyboard.press('Tab');
  await page.keyboard.type('new-password-1');
  await page.keyboard.press('Tab');
  await page.keyboard.type('new-password-2');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveText('Новые пароли не совпадают');
});
