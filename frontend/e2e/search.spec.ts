import { expect, test } from './support/test';
import {
  createCampaignWithRoles,
  createElement,
  createFreeCard,
  signInAs,
} from './support/api';

test('F13f: owner filters materials and opens a board card from search', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  await createElement(request, owner, campaignId, {
    type: 'NOTE',
    title: 'Скрытый шифр',
    access: 'MASTER_ONLY',
  });
  await createElement(request, owner, campaignId, {
    type: 'NOTE',
    title: 'Открытая карта',
    access: 'SHARED',
  });
  const cardId = await createFreeCard(
    request,
    owner,
    campaignId,
    'Следы у моста',
    { x: 100, y: 100 },
  );
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/elements`);
  await expect(
    page.getByRole('button', { name: /Найти Ctrl K/ }),
  ).toBeVisible();
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Поиск по кампании' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Скрыто' }).click();
  await expect(
    dialog.getByRole('button', { name: /Скрытый шифр/ }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: /Открытая карта/ }),
  ).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Всё' }).click();
  await dialog.getByRole('searchbox').fill('Следы');
  await dialog.getByRole('searchbox').press('Enter');
  await expect(page).toHaveURL(new RegExp(`/board\\?card=${cardId}`));
  await expect(page.getByText('Следы у моста').first()).toBeVisible();
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 700 });
    await page.getByRole('button', { name: 'Найти', exact: true }).click();
    await expect(
      page.getByRole('dialog', { name: 'Поиск по кампании' }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape');
  }
});

test('F13f: player can write from search; viewer sees only shared material', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player, viewer } =
    await createCampaignWithRoles(request);
  await createElement(request, owner, campaignId, {
    type: 'NOTE',
    title: 'Тайный план',
    access: 'MASTER_ONLY',
  });
  await createElement(request, owner, campaignId, {
    type: 'NOTE',
    title: 'Общий план',
    access: 'SHARED',
  });
  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/case`);
  await expect(
    page.getByRole('button', { name: /Найти Ctrl K/ }),
  ).toBeVisible();
  await page.keyboard.press('Control+k');
  let dialog = page.getByRole('dialog', { name: 'Поиск по кампании' });
  await expect(
    dialog.getByRole('button', { name: /Общий план/ }),
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Тайный план/ })).toHaveCount(
    0,
  );
  await dialog.getByRole('button', { name: 'Быстрая заметка' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Быстрая заметка' }),
  ).toBeVisible();
  await signInAs(page, viewer);
  await page.goto(`/campaigns/${campaignId}/case`);
  await expect(
    page.getByRole('button', { name: /Найти Ctrl K/ }),
  ).toBeVisible();
  await page.keyboard.press('Control+k');
  dialog = page.getByRole('dialog', { name: 'Поиск по кампании' });
  await expect(
    dialog.getByRole('button', { name: /Общий план/ }),
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Тайный план/ })).toHaveCount(
    0,
  );
  await expect(
    dialog.getByRole('button', { name: 'Быстрая заметка' }),
  ).toHaveCount(0);
});
