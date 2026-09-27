import { expect, test } from './support/test';
import {
  beginReturnVisit,
  createCampaignWithRoles,
  createElement,
  createFreeCard,
  signInAs,
} from './support/api';

test('B3: a returning player sees newly opened material and other people’s board work', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  await beginReturnVisit(request, player, campaignId);

  await createElement(request, owner, campaignId, {
    type: 'NOTE',
    title: 'Новая улика',
    access: 'SHARED',
  });
  const ownCard = await createFreeCard(
    request,
    player,
    campaignId,
    'Моя карточка',
    { x: 80, y: 80 },
  );
  const otherCard = await createFreeCard(
    request,
    owner,
    campaignId,
    'Чужая карточка',
    { x: 380, y: 80 },
  );
  const link = await request.post(
    `/api/campaigns/${campaignId}/investigation-links`,
    {
      headers: owner.headers,
      data: { cardAId: ownCard, cardBId: otherCard },
    },
  );
  expect(link.ok()).toBeTruthy();

  await signInAs(page, player);
  await page.goto('/campaigns');
  await expect(
    page.getByRole('link', { name: /Открыт 1 новый материал/ }),
  ).toBeVisible();
  await page.goto(`/campaigns/${campaignId}/case`);
  await expect(
    page.getByRole('region', { name: /Новое с прошлого визита/ }),
  ).toContainText('Новая улика');
  await expect(
    page
      .getByRole('navigation', { name: 'Разделы кампании' })
      .locator('.campaign-nav-new')
      .first(),
  ).toBeVisible();

  await page.goto(`/campaigns/${campaignId}/board`);
  await expect(
    page.locator('.react-flow__node', { hasText: 'Чужая карточка' }),
  ).toContainText('новое');
  await expect(
    page.locator('.react-flow__node', { hasText: 'Моя карточка' }),
  ).not.toContainText('новое');
  await expect(page.locator('.react-flow__edge.board-edge-new')).toHaveCount(1);

  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto(`/campaigns/${campaignId}/case`);
    if (width < 600) {
      await expect(
        page.locator(
          '.campaign-workspace-shell-mobile-navigation .campaign-nav-new',
        ),
      ).toBeVisible();
    } else {
      // On a tablet the dot sits on the menu and on the case inside it.
      const menu = page.getByRole('button', { name: 'Меню' });
      await expect(menu.locator('.campaign-nav-new')).toBeVisible();
      await menu.click();
      await expect(
        page
          .getByRole('navigation', { name: 'Разделы кампании' })
          .locator('.campaign-nav-new'),
      ).toBeVisible();
      await page.keyboard.press('Escape');
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});
