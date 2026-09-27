import { Browser, expect, Page, test } from './support/test';
import {
  createCampaignWithRoles,
  createPlayerCharacter,
  signInAs,
  TestUser,
} from './support/api';
import { pngFile } from './support/images';

async function openAs(browser: Browser, user: TestUser, path: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInAs(page, user);
  await page.goto(path);
  return page;
}

function uploaded(page: Page, path: RegExp) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && path.test(response.url()),
  );
}

test('P5b: a user sets and removes an account avatar', async ({
  page,
  request,
}) => {
  const { owner } = await createCampaignWithRoles(request);
  await signInAs(page, owner);
  await page.goto('/settings/account');
  const avatar = page.locator('img.avatar-large');
  await expect(avatar).toHaveAttribute('src', /^data:image\/svg\+xml/);

  const tooSmall = uploaded(page, /\/users\/me\/avatar$/);
  await page
    .getByLabel('Загрузить фото')
    .setInputFiles(await pngFile(100, 100));
  expect((await tooSmall).status()).toBe(400);
  await expect(page.getByRole('alert')).toHaveText(
    'Каждая сторона аватара должна быть от 256 до 2048 пикселей.',
  );

  const done = uploaded(page, /\/users\/me\/avatar$/);
  await page
    .getByLabel('Загрузить фото')
    .setInputFiles(await pngFile(400, 300));
  expect((await done).ok()).toBeTruthy();
  await expect(avatar).toHaveAttribute('src', /^blob:/);
  await expect(page.getByRole('alert')).toHaveCount(0);

  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(avatar).toHaveAttribute('src', /^data:image\/svg\+xml/);
});

test('P5b: a player sets the avatar of their character, others only see it', async ({
  browser,
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  const characterId = await createPlayerCharacter(
    request,
    player,
    campaignId,
    'Алекс',
  );
  const roster = `/campaigns/${campaignId}/characters`;

  // The avatar is changed on the character's own page.
  await signInAs(page, player);
  await page.goto(`${roster}/${characterId}`);
  const card = page.locator('.character-detail');
  const avatar = card.getByRole('img', { name: 'Алекс' });
  await expect(avatar).toHaveAttribute('src', /^data:image\/svg\+xml/);
  const done = uploaded(page, /\/characters\/[^/]+\/avatar$/);
  await card
    .getByLabel('Аватар персонажа')
    .setInputFiles(await pngFile(512, 512));
  expect((await done).ok()).toBeTruthy();
  await expect(avatar).toHaveAttribute('src', /^blob:/);

  const ownerPage = await openAs(browser, owner, roster);
  const ownerCard = ownerPage.locator('.character-card', { hasText: 'Алекс' });
  await expect(ownerCard.getByRole('img', { name: 'Алекс' })).toHaveAttribute(
    'src',
    /^blob:/,
  );
  await expect(
    ownerCard.getByRole('button', { name: 'Редактировать' }),
  ).toHaveCount(0);
  await ownerPage.goto(`${roster}/${characterId}`);
  await expect(ownerPage.getByRole('img', { name: 'Алекс' })).toHaveAttribute(
    'src',
    /^blob:/,
  );
  await expect(ownerPage.locator('input[type=file]')).toHaveCount(0);
});

test('P5b: the campaign cover reaches every member, including viewers', async ({
  browser,
  page,
  request,
}) => {
  const { campaignId, owner, viewer } = await createCampaignWithRoles(request);
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/settings`);

  const square = uploaded(page, /\/campaigns\/[^/]+\/cover$/);
  await page
    .getByLabel('Обложка кампании')
    .setInputFiles(await pngFile(800, 800));
  expect((await square).status()).toBe(400);
  await expect(page.getByRole('alert')).toHaveText(
    /^Обложка должна быть горизонтальной/,
  );

  const done = uploaded(page, /\/campaigns\/[^/]+\/cover$/);
  await page
    .getByLabel('Обложка кампании')
    .setInputFiles(await pngFile(1200, 700));
  expect((await done).ok()).toBeTruthy();
  await expect(page.locator('img.campaign-cover-preview')).toHaveAttribute(
    'src',
    /^blob:/,
  );

  const viewerPage = await openAs(browser, viewer, '/campaigns');
  const cover = viewerPage.locator('.campaign-card img.campaign-cover');
  await expect(cover).toHaveAttribute('src', /^blob:/);
  // A wide cover is shown whole, not squared.
  const box = await cover.boundingBox();
  expect(box && box.width / box.height).toBeGreaterThan(1.3);

  await page
    .locator('.media-upload', { hasText: 'Обложка кампании' })
    .getByRole('button', { name: 'Удалить' })
    .click();
  await expect(page.locator('img.campaign-cover-preview')).toHaveCount(0);
  await viewerPage.reload();
  await expect(
    viewerPage.getByRole('link', { name: /Тайна у озера/ }),
  ).toBeVisible();
  await expect(cover).toHaveCount(0);
});
