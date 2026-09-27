import { expect, Page, test } from './support/test';
import {
  createCampaignWithRoles,
  createElement,
  signInAs,
  TestUser,
} from './support/api';
import { png } from './support/images';

async function upload(
  page: Page,
  label: string,
  width: number,
  height: number,
) {
  const done = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/elements\/[^/]+\/(cover|map)$/.test(response.url()),
  );
  await page.getByLabel(label).setInputFiles({
    name: `${width}x${height}.png`,
    mimeType: 'image/png',
    buffer: await png(width, height),
  });
  return done;
}

async function elementMedia(
  page: Page,
  user: TestUser,
  elementId: string,
): Promise<{ coverUrl?: string | null; imageUrl?: string | null }> {
  const response = await page.request.get(`/api/elements/${elementId}`, {
    headers: user.headers,
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test('the master illustrates a location, players see it only while it is shared', async ({
  browser,
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  const elementId = await createElement(request, owner, campaignId, {
    type: 'LOCATION',
    title: 'Электростанция',
    content: 'Башни видно из любой точки острова.',
    access: 'SHARED',
  });
  const elementPath = `/campaigns/${campaignId}/elements/${elementId}`;

  await signInAs(page, owner);
  await page.goto(elementPath);
  const detail = page.locator('.note-detail');

  // Wrong map dimensions are refused with a localized message, nothing is stored.
  expect((await upload(page, 'Файл карты', 800, 600)).status()).toBe(400);
  await expect(detail.getByRole('alert')).toHaveText(
    /Длинная сторона карты должна быть от 1024 до 8192 пикселей/,
  );
  expect(
    (await elementMedia(page, owner, elementId)).imageUrl ?? null,
  ).toBeNull();

  expect((await upload(page, 'Обложка', 800, 600)).ok()).toBeTruthy();
  await expect(detail.locator('img.element-cover')).toBeVisible();
  expect((await upload(page, 'Файл карты', 2000, 1200)).ok()).toBeTruthy();

  // The map opens in the built-in viewer: zoom in and reset.
  const map = detail.getByRole('region', { name: 'Открыть карту' });
  const mapImage = map.getByRole('img', { name: 'Электростанция' });
  await expect(mapImage).toBeVisible();
  await map.getByRole('button', { name: 'Приблизить' }).click();
  await expect(mapImage).toHaveAttribute('style', /scale\(1\.25\)/);
  await map.getByRole('button', { name: 'Сбросить вид' }).click();
  await expect(mapImage).toHaveAttribute('style', /scale\(1\)/);
  await map.getByRole('button', { name: 'На весь экран' }).click();
  await expect
    .poll(() =>
      page.evaluate(() => document.fullscreenElement?.className ?? ''),
    )
    .toContain('element-map-canvas');
  await page.evaluate(() => document.exitFullscreen());
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(false);

  const { coverUrl, imageUrl } = await elementMedia(page, owner, elementId);
  expect(coverUrl).toMatch(/^\/media\//);
  expect(imageUrl).toMatch(/^\/media\//);

  // A player sees both images without upload controls.
  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await signInAs(playerPage, player);
  await playerPage.goto(elementPath);
  const playerDetail = playerPage.locator('.note-detail');
  await expect(playerDetail.locator('img.element-cover')).toBeVisible();
  await expect(
    playerDetail.getByRole('img', { name: 'Электростанция' }),
  ).toBeVisible();
  await expect(playerDetail.locator('input[type=file]')).toHaveCount(0);
  const mediaAs = (user: TestUser, url: string) =>
    playerPage.request.get(`/api${url}`, { headers: user.headers });
  expect((await mediaAs(player, coverUrl!)).status()).toBe(200);

  // Once hidden again, the images are no longer served to the player.
  await request.patch(`/api/elements/${elementId}/access`, {
    headers: owner.headers,
    data: { access: 'MASTER_ONLY' },
  });
  expect((await mediaAs(player, coverUrl!)).status()).toBe(404);
  expect((await mediaAs(player, imageUrl!)).status()).toBe(404);
  expect((await mediaAs(owner, imageUrl!)).status()).toBe(200);

  // Removing the cover takes the old file offline.
  const removed = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' &&
      response.url().endsWith('/cover'),
  );
  await detail
    .locator('.media-upload', { hasText: 'Обложка' })
    .getByRole('button', { name: 'Удалить' })
    .click();
  expect((await removed).ok()).toBeTruthy();
  await expect(detail.locator('img.element-cover')).toHaveCount(0);
  expect((await mediaAs(owner, coverUrl!)).status()).toBe(404);
});

test('a player adds a cover to their own note', async ({ page, request }) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  const elementId = await createElement(request, player, campaignId, {
    type: 'NOTE',
    title: 'Фото с места',
  });

  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/elements/${elementId}`);
  await expect(page.getByLabel('Файл карты')).toHaveCount(0);
  expect((await upload(page, 'Обложка', 600, 900)).ok()).toBeTruthy();
  await expect(page.locator('.note-detail img.element-cover')).toBeVisible();

  // While the note is private, the master cannot fetch its cover.
  const { coverUrl } = await elementMedia(page, player, elementId);
  const asOwner = await page.request.get(`/api${coverUrl}`, {
    headers: owner.headers,
  });
  expect(asOwner.status()).toBe(404);
});
