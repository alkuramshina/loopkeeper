import { expect, test } from './support/test';
import {
  createCampaignWithRoles,
  createPlayerCharacter,
  openAs,
  signInAs,
} from './support/api';

test('F13g: player conditions autosave and appear in the note widget and on the board', async ({
  browser,
  page,
  request,
}) => {
  const { campaignId, owner, player, viewer } =
    await createCampaignWithRoles(request);
  await createPlayerCharacter(request, player, campaignId, 'Алекс');
  const characters = (await (
    await request.get(`/api/campaigns/${campaignId}/characters`, {
      headers: player.headers,
    })
  ).json()) as Array<{ characterId: string }>;
  const characterId = characters[0].characterId;
  const card = await request.post(`/api/campaigns/${campaignId}/cards`, {
    headers: player.headers,
    data: { cardKind: 'CHARACTER_REFERENCE', characterId, tags: [] },
  });
  expect(card.ok()).toBeTruthy();
  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/characters/${characterId}`);
  // It is on the board already, so there is nothing to add.
  await expect(page.getByRole('heading', { name: 'Алекс' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Добавить на доску' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Сломлен(а)' }).click();
  await expect(
    page.getByRole('button', { name: 'Сломлен(а)' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status', { name: '' }).last()).toContainText(
    'Сохранено',
  );
  await page.goto(`/campaigns/${campaignId}/case`);
  await page.getByRole('button', { name: 'Заметка Alt+N' }).click();
  await expect(page.getByText('Сломлен(а)')).toBeVisible();
  await page.goto(`/campaigns/${campaignId}/board`);
  await expect(
    page.locator('.flow-card-conditions').getByText('Сломлен(а)'),
  ).toBeVisible();
  const ownerPage = await openAs(
    browser,
    owner,
    `/campaigns/${campaignId}/characters/${characterId}`,
  );
  await expect(
    ownerPage.getByRole('button', { name: 'Сломлен(а)' }),
  ).toBeDisabled();
  const viewerPage = await openAs(
    browser,
    viewer,
    `/campaigns/${campaignId}/characters/${characterId}`,
  );
  await expect(
    viewerPage.getByRole('button', { name: 'Сломлен(а)' }),
  ).toBeDisabled();
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto(`/campaigns/${campaignId}/characters/${characterId}`);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
  await ownerPage.context().close();
  await viewerPage.context().close();
});
