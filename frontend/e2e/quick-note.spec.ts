import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/test';
import {
  createCampaign,
  createCampaignWithRoles,
  createElement,
  createFreeCard,
  createPlayerCharacter,
  getBoard,
  signInAs,
} from './support/api';

test('owner writes from materials, finds notes in their own section and follows old URLs', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  const playerNote = await createElement(request, player, campaignId, {
    type: 'NOTE',
    title: 'Player clue',
    access: 'MASTER_ONLY',
  });
  await signInAs(page, owner);
  let characterRequests = 0;
  page.on('request', (req) => {
    if (req.url().endsWith('/characters')) characterRequests++;
  });
  await page.goto(`/campaigns/${campaignId}/elements`);
  await page.getByRole('button', { name: /Заметка\s*Alt\+N/ }).click();
  const form = page.getByRole('form', { name: 'Быстрая заметка' });
  await expect(form.getByRole('radio', { name: 'Только мне' })).toBeChecked();
  await expect(form.getByRole('radio', { name: 'Личное' })).toHaveCount(0);
  await form.getByRole('textbox').fill('Owner hypothesis\nLook at the lake');
  await form.getByRole('button', { name: 'Сохранить заметку' }).click();
  await expect(form).toHaveCount(0);
  const open = page.getByRole('link', { name: 'Открыть заметку' });
  const href = await open.getAttribute('href');
  await open.click();
  await expect(page.getByRole('article')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Название' })).toHaveValue(
    'Owner hypothesis',
  );
  await expect(page.getByRole('radio', { name: 'Только мне' })).toBeChecked();
  expect(characterRequests).toBe(0);
  await page.goto(href!.replace('/notes/', '/elements/'));
  await expect(page).toHaveURL(href!);
  await page.goto(`/campaigns/${campaignId}/elements`);
  await expect(
    page
      .getByRole('navigation', { name: 'Список материалов' })
      .getByText('Owner hypothesis'),
  ).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Player clue/ })).toHaveAttribute(
    'href',
    `/campaigns/${campaignId}/elements/${playerNote}`,
  );
  await page.getByRole('button', { name: 'Материал', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('option', { name: 'Заметка' }),
  ).toHaveCount(0);
});

test('draft, focus, pinning and board state survive navigation and every layout boundary', async ({
  page,
  request,
}) => {
  const { campaignId, player } = await createCampaignWithRoles(request);
  await createFreeCard(request, player, campaignId, 'Lake', { x: 0, y: 0 });
  await createPlayerCharacter(request, player, campaignId, 'Maya');
  await signInAs(page, player);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/campaigns/${campaignId}/board`);
  await expect(page.locator('.react-flow')).toBeVisible();
  await expect(page.locator('.quick-note-fab')).toBeHidden();
  await page.keyboard.press('Alt+n');
  const form = page.getByRole('form', { name: 'Быстрая заметка' });
  const input = form.getByRole('textbox');
  await expect(input).toBeFocused();
  await input.fill('The lake hums');
  await expect(page.locator('.quick-note-character summary')).toContainText(
    'Maya',
  );
  await page.getByRole('button', { name: 'Закрепить', exact: true }).click();
  await page.locator('.react-flow__node').click();
  const before = await page
    .locator('.react-flow__viewport')
    .getAttribute('style');
  const selected = await page.locator('.react-flow__node.selected').count();
  await input.focus();
  for (const width of [1279, 1023, 599, 320, 599, 1023, 1279, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(input).toHaveValue('The lake hums');
    await expect(input).toBeFocused();
    expect(await page.locator('.react-flow__node.selected').count()).toBe(
      selected,
    );
    expect(
      await page.locator('.react-flow__viewport').getAttribute('style'),
    ).toBe(before);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole('link', { name: 'Дело', exact: false }).click();
  await expect(input).toHaveValue('The lake hums');
  await page.getByRole('link', { name: 'Мои заметки' }).click();
  await expect(input).toHaveValue('The lake hums');
  await page.reload();
  await expect(
    page.getByRole('button', { name: /Заметка\s*Alt\+N/ }),
  ).toBeVisible();
  await page.keyboard.press('Alt+n');
  await expect(input).toHaveValue('The lake hums');
  await form.getByText('Всем', { exact: true }).click();
  await form.getByRole('button', { name: 'Сохранить заметку' }).click();
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(form.getByRole('radio', { name: 'Личное' })).toBeChecked();
  await expect(page.locator('.quick-note-panel-pinned')).toBeVisible();
});

test('search opens in place, query flags preserve URL context and Escape respects active dialogs', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  await signInAs(page, owner);
  await page.goto(
    `/campaigns/${campaignId}/settings?quick-note=1&keep=yes#details`,
  );
  const input = page
    .getByRole('form', { name: 'Быстрая заметка' })
    .getByRole('textbox');
  await expect(input).toBeFocused();
  await expect(page).toHaveURL(
    `/campaigns/${campaignId}/settings?keep=yes#details`,
  );
  await input.press('Escape');
  await expect(input).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Быстрая заметка' })
    .click();
  await expect(input).toBeFocused();
  await expect(page).toHaveURL(
    `/campaigns/${campaignId}/settings?keep=yes#details`,
  );
  await page.keyboard.press('Control+k');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(input).toBeVisible();
});

test('delayed save survives closing, navigation and resize; failed saves preserve the draft', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/elements`);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let posts = 0;
  await page.route(`**/api/campaigns/${campaignId}/elements`, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    posts++;
    await gate;
    await route.continue();
  });
  await page.getByRole('button', { name: /Заметка\s*Alt\+N/ }).click();
  const form = page.getByRole('form', { name: 'Быстрая заметка' });
  await form.getByRole('textbox').fill('Delayed thought');
  await form.getByRole('button', { name: 'Сохранить заметку' }).click();
  await expect(form.getByRole('textbox')).toHaveAttribute('readonly');
  await expect(form.getByRole('radio', { name: 'Всем' })).toBeDisabled();
  await form.getByRole('textbox').press('Control+Enter');
  await page
    .getByRole('region', { name: 'Быстрая заметка' })
    .getByRole('button', { name: 'Закрыть' })
    .click();
  await page.getByRole('link', { name: 'Мои заметки' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Быстрая заметка' }).click();
  await expect(form.getByRole('textbox')).toHaveValue('Delayed thought');
  await expect(
    form.getByRole('button', { name: 'Сохранение…' }),
  ).toBeDisabled();
  release();
  await expect(form).toHaveCount(0);
  expect(posts).toBe(1);
  await page.unroute(`**/api/campaigns/${campaignId}/elements`);
  await page.route(`**/api/campaigns/${campaignId}/elements`, (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 500, json: { code: 'common.internal_error' } })
      : route.continue(),
  );
  await page.getByRole('button', { name: 'Быстрая заметка' }).click();
  await form.getByRole('textbox').fill('Retry me');
  await form.getByRole('button', { name: 'Сохранить заметку' }).click();
  await expect(form.getByRole('alert')).toBeVisible();
  await expect(form.getByRole('textbox')).toHaveValue('Retry me');
});

test('private hypothesis becomes shared through preview, reaches the board and is readable to a viewer', async ({
  page,
  request,
  browser,
}) => {
  const { campaignId, owner, player, viewer } =
    await createCampaignWithRoles(request);
  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/board`);
  await expect(page.locator('.react-flow')).toBeVisible();
  await page.keyboard.press('Alt+n');
  const form = page.getByRole('form', { name: 'Быстрая заметка' });
  await form
    .getByRole('textbox')
    .fill('Private hypothesis\nSomeone is listening.');
  await form.getByRole('button', { name: 'Сохранить заметку' }).click();
  await page.getByRole('link', { name: 'Открыть заметку' }).click();
  await page
    .locator('.note-visibility')
    .getByText('Всем', { exact: true })
    .click();
  const preview = page.getByRole('dialog');
  await expect(preview).toContainText('Someone is listening.');
  await preview
    .getByRole('button', { name: 'Показать всем', exact: true })
    .click();
  await page.getByRole('button', { name: 'Добавить на доску' }).click();
  await expect
    .poll(
      async () => (await getBoard(request, player, campaignId)).cards.length,
    )
    .toBe(1);
  const context = await browser.newContext();
  const observer = await context.newPage();
  await signInAs(observer, viewer);
  await observer.goto(`/campaigns/${campaignId}/case`);
  await observer.getByRole('link', { name: /Private hypothesis/ }).click();
  await expect(observer.getByRole('article')).toContainText(
    'Someone is listening.',
  );
  await expect(observer.getByRole('form')).toHaveCount(0);
  await expect(
    observer.getByRole('button', { name: 'Добавить на доску' }),
  ).toHaveCount(0);
  await context.close();
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/elements`);
  await expect(
    page.getByRole('link', { name: /Private hypothesis/ }),
  ).toBeVisible();
});

test('owner editor rejects foreign notes, other types and another campaign without redirect loops', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  const foreign = await createElement(request, player, campaignId, {
    type: 'NOTE',
    title: 'Foreign note',
    access: 'SHARED',
  });
  const location = await createElement(request, owner, campaignId, {
    type: 'LOCATION',
    title: 'Lake',
    access: 'SHARED',
  });
  const other = await createCampaign(request, owner, 'Another campaign');
  const outside = await createElement(request, owner, other, {
    type: 'NOTE',
    title: 'Other tenant',
  });
  await signInAs(page, owner);
  for (const id of [foreign, location]) {
    await page.goto(`/campaigns/${campaignId}/notes/${id}`);
    await expect(page).toHaveURL(`/campaigns/${campaignId}/elements/${id}`);
    await expect(page.locator('.note-editor')).toHaveCount(0);
  }
  await page.goto(`/campaigns/${campaignId}/notes/${outside}`);
  await expect(
    page.getByRole('heading', { name: 'Материал недоступен' }),
  ).toBeVisible();
  await expect(page.locator('.note-editor')).toHaveCount(0);
});

test('mobile and desktop note surfaces pass axe in both variations', async ({
  page,
  request,
}, testInfo) => {
  const { campaignId, player } = await createCampaignWithRoles(request);
  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/case`);
  await expect(
    page.getByRole('button', { name: 'Быстрая заметка', exact: true }),
  ).toBeVisible();
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 568 });
      await page.keyboard.press('Alt+n');
      await expect(page.getByRole('form')).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((item) => item.id)).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`widget-${colorScheme}-${width}.png`),
      });
      await page.getByRole('form').getByRole('textbox').press('Escape');
    }
  }
});

test('drafts stay private across campaigns, accounts, role loss and membership loss', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player, viewer } =
    await createCampaignWithRoles(request);
  const other = await createCampaign(request, player, 'Another mystery');
  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/case`);
  await page
    .getByRole('button', { name: 'Быстрая заметка', exact: true })
    .click();
  const form = page.getByRole('form', { name: 'Быстрая заметка' });
  await form.getByRole('textbox').fill('A private draft');
  await page.goto(`/campaigns/${other}/elements?quick-note=1`);
  await expect(form.getByRole('textbox')).toHaveValue('');
  await page.goto(`/campaigns/${campaignId}/case?quick-note=1`);
  await expect(form.getByRole('textbox')).toHaveValue('A private draft');
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await signInAs(page, viewer);
  await page.goto(
    `/campaigns/${campaignId}/case?quick-note=1&keep=yes#material`,
  );
  await expect(page).toHaveURL(
    `/campaigns/${campaignId}/case?keep=yes#material`,
  );
  await page.keyboard.press('Alt+n');
  await expect(form).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Быстрая заметка', exact: true }),
  ).toHaveCount(0);
  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/case?quick-note=1`);
  await expect(form.getByRole('textbox')).toHaveValue('A private draft');
  const demote = await request.patch(
    `/api/campaigns/${campaignId}/members/${player.userId}`,
    { headers: owner.headers, data: { role: 'VIEWER' } },
  );
  expect(demote.ok()).toBe(true);
  // A stale snapshot attempts a save; refreshed access already hides the form.
  await page.evaluate(() => {
    document
      .querySelector<HTMLButtonElement>(
        '[data-quick-note] button[type="submit"]',
      )
      ?.click();
  });
  await expect(form).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /Заметка\s*Alt\+N/ }),
  ).toHaveCount(0);
  const restore = await request.patch(
    `/api/campaigns/${campaignId}/members/${player.userId}`,
    { headers: owner.headers, data: { role: 'PLAYER' } },
  );
  expect(restore.ok()).toBe(true);
  await page.reload();
  await page
    .getByRole('button', { name: 'Быстрая заметка', exact: true })
    .click();
  await expect(form.getByRole('textbox')).toHaveValue('A private draft');
  const remove = await request.delete(
    `/api/campaigns/${campaignId}/members/${player.userId}`,
    { headers: owner.headers },
  );
  expect(remove.ok()).toBe(true);
  await page.evaluate(() => {
    document
      .querySelector<HTMLButtonElement>(
        '[data-quick-note] button[type="submit"]',
      )
      ?.click();
  });
  await expect(form).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /недоступ/i })).toBeVisible();
});
