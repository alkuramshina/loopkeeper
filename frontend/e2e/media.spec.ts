import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, Locator, Page, test } from './support/test';
import {
  beginReturnVisit,
  createCampaign,
  createCampaignWithRoles,
  createElement,
  createElementCard,
  createFreeCard,
  createPlayerCharacter,
  getBoard,
  listCampaignTitles,
  openAs,
  registerUser,
  signInAs,
  TestUser,
  uploadMedia,
} from './support/api';
import {
  fakePng,
  imageFile,
  oversizedPng,
  png,
  pngFile,
  svgFile,
} from './support/images';

// The browser-test API stores media here (see playwright.config.ts).
// Playwright runs from frontend/; the API runs from the repository root.
const storagePath = join(process.cwd(), '..', 'data', 'browser-test-media');
const storedFiles = () => readdirSync(storagePath).length;

function uploaded(page: Page, path: RegExp) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && path.test(response.url()),
  );
}

async function naturalSize(image: Locator) {
  await expect(image).toHaveAttribute('src', /^blob:/);
  await expect
    .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
    .toBeGreaterThan(0);
  return image.evaluate((node: HTMLImageElement) => ({
    width: node.naturalWidth,
    height: node.naturalHeight,
  }));
}

async function media(page: Page, user: TestUser, url: string) {
  return (
    await page.request.get(`/api${url}`, { headers: user.headers })
  ).status();
}

async function currentUser(page: Page, user: TestUser) {
  const response = await page.request.get('/api/auth/me', {
    headers: user.headers,
  });
  return (await response.json()) as { avatarUrl: string | null };
}

async function element(page: Page, user: TestUser, elementId: string) {
  const response = await page.request.get(`/api/elements/${elementId}`, {
    headers: user.headers,
  });
  return (await response.json()) as {
    coverUrl: string | null;
    imageUrl: string | null;
  };
}

test('P5b: character avatars accept PNG, JPEG and WebP and are cropped to a square', async ({
  page,
  request,
}) => {
  const { campaignId, player } = await createCampaignWithRoles(request);
  const characterId = await createPlayerCharacter(
    request,
    player,
    campaignId,
    'Алекс',
  );
  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/characters/${characterId}`);

  const card = page.locator('.character-detail');
  const avatar = card.getByRole('img', { name: 'Алекс' });
  const input = card.getByLabel('Аватар персонажа');
  for (const file of [
    await imageFile(600, 600, 'png'),
    await imageFile(900, 400, 'jpeg'),
    await imageFile(300, 700, 'webp'),
  ]) {
    const done = uploaded(page, /\/characters\/[^/]+\/avatar$/);
    await input.setInputFiles(file);
    expect((await done).ok(), file.name).toBeTruthy();
    // A rectangle is centre-cropped and normalised to 512×512.
    await expect
      .poll(async () => naturalSize(avatar), { message: file.name })
      .toEqual({ width: 512, height: 512 });
  }

  await card
    .locator('.media-upload')
    .getByRole('button', { name: 'Удалить' })
    .click();
  await expect(avatar).toHaveAttribute('src', /^data:image\/svg\+xml/);
});

test('P5b: media is not served to outsiders and a replaced avatar goes offline', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  const outsider = await registerUser(request, 'Посторонний');
  await createPlayerCharacter(request, player, campaignId, 'Алекс');
  await uploadMedia(
    request,
    owner,
    `/campaigns/${campaignId}/cover`,
    await png(1200, 700),
  );
  const cover = (
    (await (
      await request.get(`/api/campaigns/${campaignId}`, {
        headers: owner.headers,
      })
    ).json()) as { coverUrl: string }
  ).coverUrl;
  expect(await media(page, player, cover)).toBe(200);
  // Tenant-neutral: an outsider cannot tell the asset exists.
  expect(await media(page, outsider, cover)).toBe(404);
  expect(
    await media(page, outsider, '/media/00000000-0000-4000-8000-000000000001'),
  ).toBe(404);

  // Replacing the account avatar while the new image loads slowly: the old
  // image is not shown in the meantime and its URL stops working.
  await signInAs(page, owner);
  await page.goto('/settings/account');
  const avatar = page.locator('img.avatar-large');
  const input = page.getByLabel('Загрузить фото');
  let done = uploaded(page, /\/users\/me\/avatar$/);
  await input.setInputFiles(await pngFile(400, 400));
  await done;
  await expect(avatar).toHaveAttribute('src', /^blob:/);
  const oldSource = await avatar.getAttribute('src');
  const oldUrl = (await currentUser(page, owner)).avatarUrl!;

  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/media/*', async (route) => {
    if (!route.request().url().endsWith(oldUrl)) await held;
    await route.fallback();
  });
  done = uploaded(page, /\/users\/me\/avatar$/);
  await input.setInputFiles(await pngFile(500, 500));
  await done;
  await expect(avatar).not.toHaveAttribute('src', oldSource!);
  await expect(avatar).toHaveAttribute('src', /^data:image\/svg\+xml/);
  release();
  await expect(avatar).toHaveAttribute('src', /^blob:/);
  await expect(avatar).not.toHaveAttribute('src', oldSource!);
  await page.unroute('**/api/media/*');
  expect(await media(page, owner, oldUrl)).toBe(404);
});

test('P5b: bad avatar files are refused with a localized message and nothing is stored', async ({
  page,
  request,
}) => {
  const owner = await registerUser(request, 'Мастер');
  await signInAs(page, owner);
  await page.goto('/settings/account');
  const input = page.getByLabel('Загрузить фото');
  const files = storedFiles();

  const cases: [string, Parameters<Locator['setInputFiles']>[0], RegExp][] = [
    ['over 5 MiB', oversizedPng(6 * 1024 * 1024), /^Файл слишком большой/],
    [
      'not an image',
      fakePng(),
      /^(Не удалось прочитать изображение|Поддерживаются только)/,
    ],
    ['too small', await pngFile(100, 100), /^Каждая сторона аватара/],
  ];
  for (const [name, file, message] of cases) {
    const done = uploaded(page, /\/users\/me\/avatar$/);
    await input.setInputFiles(file);
    expect((await done).status(), name).toBeGreaterThanOrEqual(400);
    await expect(page.getByRole('alert'), name).toHaveText(message);
  }
  expect((await currentUser(page, owner)).avatarUrl).toBeNull();
  expect(storedFiles()).toBe(files);

  // A dropped connection fails the upload; the next attempt succeeds.
  await page.route('**/api/users/me/avatar', (route) =>
    route.abort('connectionrefused'),
  );
  await input.setInputFiles(await pngFile(400, 400));
  await expect(page.getByRole('alert')).toBeVisible();
  await page.unroute('**/api/users/me/avatar');
  const done = uploaded(page, /\/users\/me\/avatar$/);
  await input.setInputFiles(await pngFile(400, 400));
  expect((await done).ok()).toBeTruthy();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('img.avatar-large')).toHaveAttribute(
    'src',
    /^blob:/,
  );
});

test('P5d: element covers keep their proportions; replacing and removing them works', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  const elementId = await createElement(request, owner, campaignId, {
    type: 'NPC',
    title: 'Сторож',
    typeData: { role: 'Сторож' },
  });
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/elements/${elementId}`);
  const detail = page.getByRole('article');
  await detail.getByRole('button', { name: 'Изменить' }).click();
  const cover = detail.locator('img.element-cover');
  const input = page.getByRole('main').getByLabel('Обложка');

  await input.setInputFiles(await pngFile(600, 900));
  expect(await naturalSize(cover)).toEqual({ width: 600, height: 900 });
  const portraitUrl = (await element(page, owner, elementId)).coverUrl!;

  await input.setInputFiles(await pngFile(1800, 1000));
  await expect
    .poll(() => naturalSize(cover))
    .toEqual({ width: 1024, height: 569 });
  expect(await media(page, owner, portraitUrl)).toBe(404);
  // The whole image is visible: it is contained in its box, never cropped.
  expect(await cover.evaluate((node) => getComputedStyle(node).objectFit)).toBe(
    'contain',
  );

  await detail
    .locator('.media-upload', { hasText: 'Обложка' })
    .getByRole('button', { name: 'Удалить' })
    .click();
  await expect(cover).toHaveCount(0);
  expect((await element(page, owner, elementId)).coverUrl).toBeNull();
});

test('P5d: an uploaded map survives an edit, pans in the viewer and yields to an external link', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  const elementId = await createElement(request, owner, campaignId, {
    type: 'LOCATION',
    title: 'Порт',
  });
  await uploadMedia(
    request,
    owner,
    `/elements/${elementId}/map`,
    await png(3000, 2000),
  );
  const uploadedMap = (await element(page, owner, elementId)).imageUrl!;
  await page.route('https://maps.test/**', async (route) =>
    route.fulfill({ contentType: 'image/png', body: await png(1200, 800) }),
  );
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/elements/${elementId}`);

  const map = page.getByRole('region', { name: 'Открыть карту' });
  const image = map.getByRole('img', { name: 'Порт' });
  await expect(image).toHaveAttribute('src', /^blob:/);
  const canvas = await map.locator('.element-map-canvas').boundingBox();
  await page.mouse.move(canvas!.x + 50, canvas!.y + 50);
  await page.mouse.down();
  await page.mouse.move(canvas!.x + 130, canvas!.y + 90, { steps: 5 });
  await page.mouse.up();
  await expect(image).toHaveAttribute('style', /translate\(80px, 40px\)/);
  await map.getByRole('button', { name: 'Отдалить' }).click();
  await expect(image).toHaveAttribute('style', /scale\(0\.75\)/);
  await map.getByRole('button', { name: 'Сбросить вид' }).click();
  await expect(image).toHaveAttribute(
    'style',
    /translate\(0px, 0px\) scale\(1\)/,
  );

  // Editing other fields without touching the link keeps the uploaded file.
  const detail = page.getByRole('article');
  await detail.getByRole('button', { name: 'Изменить' }).click();
  await expect(detail.getByLabel('HTTPS-адрес карты')).toHaveValue('');
  await expect(detail.getByText(/Новая ссылка заменит его/)).toBeVisible();
  await detail.getByLabel('Текст').fill('Причал и маяк.');
  await expect(detail.getByRole('status')).toHaveText('Сохранено');
  expect((await element(page, owner, elementId)).imageUrl).toBe(uploadedMap);

  // An external link replaces the file, which goes offline.
  await detail
    .getByLabel('HTTPS-адрес карты')
    .fill('https://maps.test/port.png');
  await expect(detail.getByRole('status')).toHaveText('Сохранено');
  await detail.getByRole('button', { name: 'Готово' }).click();
  await expect(image).toHaveAttribute('src', 'https://maps.test/port.png');
  expect((await element(page, owner, elementId)).imageUrl).toBe(
    'https://maps.test/port.png',
  );
  expect(await media(page, owner, uploadedMap)).toBe(404);
});

test('P5d: bad map and cover files are refused and nothing is stored', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  const elementId = await createElement(request, owner, campaignId, {
    type: 'LOCATION',
    title: 'Порт',
  });
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/elements/${elementId}`);
  await page.getByRole('button', { name: 'Изменить' }).click();
  const files = storedFiles();

  const cases: [
    string,
    string,
    Parameters<Locator['setInputFiles']>[0],
    RegExp,
  ][] = [
    [
      'map over 10 MiB',
      'Файл карты',
      oversizedPng(11 * 1024 * 1024),
      /^Файл слишком большой/,
    ],
    [
      'small map',
      'Файл карты',
      await pngFile(800, 600),
      /^Длинная сторона карты/,
    ],
    [
      'SVG map',
      'Файл карты',
      svgFile(),
      /^(Поддерживаются только|Не удалось прочитать)/,
    ],
    [
      'narrow cover',
      'Обложка',
      await pngFile(1200, 400),
      /^Каждая сторона обложки/,
    ],
  ];
  for (const [name, label, file, message] of cases) {
    const upload = page.locator('.media-upload', { hasText: label });
    const done = uploaded(page, /\/elements\/[^/]+\/(map|cover)$/);
    await page.getByRole('main').getByLabel(label).setInputFiles(file);
    expect((await done).status(), name).toBeGreaterThanOrEqual(400);
    await expect(upload.getByRole('alert'), name).toHaveText(message);
  }
  expect(await element(page, owner, elementId)).toMatchObject({
    coverUrl: null,
    imageUrl: null,
  });
  expect(storedFiles()).toBe(files);
});

test('P5d: deleting an element removes its cover and map files', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  const elementId = await createElement(request, owner, campaignId, {
    type: 'LOCATION',
    title: 'Порт',
  });
  await uploadMedia(
    request,
    owner,
    `/elements/${elementId}/cover`,
    await png(800, 600),
  );
  await uploadMedia(
    request,
    owner,
    `/elements/${elementId}/map`,
    await png(2000, 1500),
  );
  const { coverUrl, imageUrl } = await element(page, owner, elementId);
  const files = storedFiles();

  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/elements/${elementId}`);
  await page.getByRole('button', { name: 'Ещё действия' }).click();
  await page.getByRole('menuitem', { name: 'Удалить' }).click();
  // Closing the notice commits the deletion at once.
  const deleted = page.waitForResponse(
    (response) => response.request().method() === 'DELETE' && response.ok(),
  );
  await page
    .getByRole('status')
    .filter({ hasText: 'будет удалён' })
    .getByRole('button', { name: 'Закрыть' })
    .click();
  await deleted;
  await expect(page.getByText('Материалов пока нет')).toBeVisible();

  expect(await media(page, owner, coverUrl!)).toBe(404);
  expect(await media(page, owner, imageUrl!)).toBe(404);
  await expect.poll(storedFiles).toBe(files - 2);
});

test('P5d: element covers appear on board cards and in case previews', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  await beginReturnVisit(request, player, campaignId);
  const portrait = await createElement(request, owner, campaignId, {
    type: 'NPC',
    title: 'Портрет',
    access: 'SHARED',
    typeData: { role: 'Свидетель' },
  });
  const landscape = await createElement(request, owner, campaignId, {
    type: 'LOCATION',
    title: 'Пейзаж',
    access: 'SHARED',
  });
  await uploadMedia(
    request,
    owner,
    `/elements/${portrait}/cover`,
    await png(600, 900),
  );
  await uploadMedia(
    request,
    owner,
    `/elements/${landscape}/cover`,
    await png(1200, 600),
  );
  const portraitCard = await createElementCard(
    request,
    owner,
    campaignId,
    portrait,
    {
      x: 0,
      y: 0,
      width: 240,
      height: 360,
    },
  );
  await createElementCard(request, owner, campaignId, landscape, {
    x: 400,
    y: 0,
    width: 240,
    height: 240,
  });

  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/elements`);
  for (const title of ['Портрет', 'Пейзаж']) {
    const item = page.getByRole('link', { name: new RegExp(title) });
    const thumbnail = item.locator('img.case-card-cover');
    await expect(thumbnail).toHaveAttribute('src', /^blob:/);
    const thumb = await thumbnail.boundingBox();
    const text = await item.locator('.case-card-title').boundingBox();
    expect(thumb!.y + thumb!.height, title).toBeLessThanOrEqual(text!.y + 1);
  }

  await page.goto(`/campaigns/${campaignId}/board`);
  const card = (title: string) =>
    page.locator('.react-flow__node', { hasText: title });
  for (const [title, ratio] of [
    ['Портрет', 600 / 900],
    ['Пейзаж', 1200 / 600],
  ] as const) {
    const cover = card(title).locator('img.flow-card-cover');
    await expect(cover).toHaveAttribute('src', /^blob:/);
    // Board cards crop covers, while the source image keeps its proportions.
    expect(
      await cover.evaluate((node) => getComputedStyle(node).objectFit),
    ).toBe('cover');
    const size = await naturalSize(cover);
    expect(size.width / size.height, title).toBeCloseTo(ratio, 1);
    // The text is not covered by the image.
    const image = await cover.boundingBox();
    const heading = await card(title).locator('h3').boundingBox();
    expect(heading!.y, title).toBeGreaterThanOrEqual(
      image!.y + image!.height - 1,
    );
  }

  // The card can be dragged by its image.
  const cover = card('Портрет').locator('img.flow-card-cover');
  await cover.scrollIntoViewIfNeeded();
  const before = await cover.boundingBox();
  const moved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().includes(`/investigation-board/nodes/${portraitCard}`),
  );
  await page.mouse.move(
    before!.x + before!.width / 2,
    before!.y + before!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    before!.x + before!.width / 2,
    before!.y + before!.height / 2 + 120,
    { steps: 8 },
  );
  await page.mouse.up();
  expect((await moved).ok()).toBeTruthy();
  const node = (await getBoard(request, owner, campaignId)).cards.find(
    (item) => item.cardId === portraitCard,
  )?.node;
  expect(node?.y).toBeGreaterThan(50);

  // The cover remains available after moving the card.
  await expect(cover).toBeVisible();
});

test('P5d: deleting a campaign with members, media and a board removes it for everyone only', async ({
  browser,
  page,
  request,
}) => {
  const { campaignId, owner, player, viewer } =
    await createCampaignWithRoles(request);
  const otherCampaign = await createCampaign(request, player, 'Своя кампания');
  await createPlayerCharacter(request, player, campaignId, 'Алекс');
  const characters = (await (
    await request.get(`/api/campaigns/${campaignId}/characters`, {
      headers: player.headers,
    })
  ).json()) as Array<{ characterId: string }>;
  await uploadMedia(
    request,
    player,
    `/characters/${characters[0].characterId}/avatar`,
    await png(512, 512),
  );
  const location = await createElement(request, owner, campaignId, {
    type: 'LOCATION',
    title: 'Порт',
    access: 'SHARED',
  });
  await uploadMedia(
    request,
    owner,
    `/elements/${location}/cover`,
    await png(800, 600),
  );
  await uploadMedia(
    request,
    owner,
    `/elements/${location}/map`,
    await png(2000, 1500),
  );
  await uploadMedia(
    request,
    owner,
    `/campaigns/${campaignId}/cover`,
    await png(1200, 700),
  );
  await createElementCard(request, player, campaignId, location, {
    x: 0,
    y: 0,
    width: 240,
    height: 200,
  });
  await createFreeCard(request, player, campaignId, 'Улика', { x: 400, y: 0 });
  const { coverUrl, imageUrl } = await element(page, owner, location);

  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/settings/delete`);
  await page.getByRole('button', { name: 'Удалить кампанию' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Удалить кампанию' })
    .click();
  await expect(page).toHaveURL(/\/campaigns$/);

  expect(await listCampaignTitles(request, owner)).toEqual([]);
  expect(await listCampaignTitles(request, player)).toEqual(['Своя кампания']);
  expect(await listCampaignTitles(request, viewer)).toEqual([]);
  expect(await media(page, owner, coverUrl!)).toBe(404);
  expect(await media(page, owner, imageUrl!)).toBe(404);

  // Accounts survive: the player still signs in and opens their own campaign.
  const playerPage = await openAs(browser, player, '/campaigns');
  await expect(playerPage.locator('.campaign-card')).toHaveCount(1);
  await playerPage.locator('.campaign-card').click();
  await expect(playerPage).toHaveURL(`/campaigns/${otherCampaign}/board`);
  await playerPage.goto(`/campaigns/${campaignId}/board`);
  await expect(playerPage.getByRole('alert')).toHaveText(
    'Этот ресурс недоступен.',
  );
});
