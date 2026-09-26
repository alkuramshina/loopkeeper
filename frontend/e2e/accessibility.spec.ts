import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';
import {
  createCampaignWithRoles,
  createElement,
  createFreeCard,
  createPlayerCharacter,
  listElementTitles,
  signInAs,
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
