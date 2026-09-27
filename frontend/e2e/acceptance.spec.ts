import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import { expect, Page, test } from './support/test';
import {
  createCampaignWithRoles,
  createElement,
  createFreeCard,
  createPlayerCharacter,
  setFixedBackground,
  signInAs,
} from './support/api';
import { iconButtonContrastIssues } from './support/contrast';

// F13h acceptance: the layout ranges of the redesign plan, state that survives
// a change of range, reduced motion and contrast over campaign backgrounds.

const navigationName = 'Разделы кампании';

/** Axe WCAG 2.1 A/AA findings as "rule: element — reason" lines. */
async function axeViolations(page: Page, include?: string) {
  const builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
  ]);
  if (include) builder.include(include);
  const results = await builder.analyze();
  return results.violations.flatMap((violation) =>
    violation.nodes
      .slice(0, 3)
      .map(
        (node) =>
          `${violation.id}: ${node.target.join(' ')} — ${node.any[0]?.message ?? ''}`,
      ),
  );
}

function sidebar(page: Page) {
  return page.locator('.campaign-workspace-shell-sidebar');
}

test('the workspace shell follows every layout range', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  await signInAs(page, owner);
  const menu = page.getByRole('button', { name: 'Меню' });

  // ≥ 1280: the mockup's sidebar with words.
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`/campaigns/${campaignId}/members`);
  const side = sidebar(page);
  await expect(side.getByText('Участники', { exact: true })).toBeVisible();
  expect((await side.boundingBox())?.width).toBeGreaterThan(200);
  await expect(menu).toBeHidden();

  // 1024–1279: icons only, the words stay the links' names and show on hover.
  await page.setViewportSize({ width: 1100, height: 768 });
  expect((await side.boundingBox())?.width).toBeLessThan(100);
  const board = side.getByRole('link', { name: 'Доска расследования' });
  await expect(board).toBeVisible();
  await board.hover();
  await expect(board.getByText('Доска расследования')).toBeVisible();
  await expect(menu).toBeHidden();

  // 600–1023: the sidebar slides out over the content.
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(side).toBeHidden();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(side).toBeVisible();
  await expect(side.getByRole('link').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(side).toBeHidden();
  await expect(menu).toBeFocused();
  await menu.click();
  await side.getByRole('link', { name: 'Настройки кампании' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(side).toBeHidden();
  // A tap outside the menu closes it.
  await menu.click();
  await page.mouse.click(740, 600);
  await expect(side).toBeHidden();

  // < 600: the same sidebar opens from the menu button.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(side.getByRole('link', { name: 'Доска расследования' })).toBeVisible();
  await page.keyboard.press('Escape');

  // An open menu does not survive into the sidebar ranges and back.
  await page.setViewportSize({ width: 768, height: 1024 });
  await menu.click();
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(
    page.getByRole('navigation', { name: navigationName }),
  ).toBeVisible();
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(side).toBeHidden();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
});

test('the board inspector, minimap and search follow the layout ranges', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  await createFreeCard(request, owner, campaignId, 'Радиосигнал', {
    x: 0,
    y: 0,
  });
  await signInAs(page, owner);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/campaigns/${campaignId}/board`);
  const canvas = page.locator('.board-canvas');
  const inspector = page.locator('.board-inspector');
  const minimap = page.locator('.react-flow__minimap');
  const search = page.getByPlaceholder('Найти на доске');
  const searchToggle = page.getByRole('button', { name: 'Найти на доске' });

  // ≥ 1280: the inspector is a column beside the canvas.
  await expect(minimap).toBeVisible();
  await expect(search).toBeVisible();
  await expect(searchToggle).toBeHidden();
  await page.getByRole('button', { name: 'Новая карточка' }).click();
  await expect(inspector).toBeVisible();
  const wideCanvas = await canvas.boundingBox();
  const wideInspector = await inspector.boundingBox();
  expect(wideInspector!.x).toBeGreaterThanOrEqual(
    wideCanvas!.x + wideCanvas!.width - 1,
  );

  // 600–1279: the inspector slides over the canvas, which keeps its size.
  for (const width of [1100, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(inspector).toBeVisible();
    const box = await canvas.boundingBox();
    const over = await inspector.boundingBox();
    expect(over!.x, `${width}: over the canvas`).toBeLessThan(
      box!.x + box!.width,
    );
    await inspector.getByRole('button', { name: 'Отмена' }).click();
    await expect(inspector).toBeHidden();
    expect((await canvas.boundingBox())!.width, `${width}: canvas`).toBeCloseTo(
      box!.width,
      0,
    );
    await page.getByRole('button', { name: 'Новая карточка' }).click();
  }

  // Below 1024 the minimap hides and the search folds into an icon.
  await expect(minimap).toBeHidden();
  await expect(search).toBeHidden();
  await searchToggle.click();
  await expect(search).toBeFocused();
  await search.fill('Радио');
  await search.blur();
  // A search in progress stays open.
  await expect(search).toBeVisible();
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect(minimap).toBeVisible();
});

test('changing the layout range keeps input, selection and open panels', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  const materialId = await createElement(request, owner, campaignId, {
    type: 'LOCATION',
    title: 'Водонапорная башня',
    content: 'Лестница обрывается на середине.',
    access: 'SHARED',
  });
  await createFreeCard(request, owner, campaignId, 'Радиосигнал', {
    x: 0,
    y: 0,
  });

  // The board: a card being written and its inspector.
  await signInAs(page, owner);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/campaigns/${campaignId}/board`);
  await page.getByRole('button', { name: 'Новая карточка' }).click();
  await page.getByLabel('Название карточки').fill('Следы у ограды');
  for (const width of [1100, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByLabel('Название карточки'), `${width}`).toHaveValue(
      'Следы у ограды',
    );
  }
  // A selected card stays selected.
  await page.getByRole('button', { name: 'Отмена' }).click();
  const card = page.locator('.react-flow__node', { hasText: 'Радиосигнал' });
  await card.click();
  for (const width of [1100, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(card, `${width}`).toHaveClass(/selected/);
  }

  // Materials: the selected material lives in the URL.
  await page.goto(`/campaigns/${campaignId}/elements/${materialId}`);
  for (const width of [768, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page, `${width}`).toHaveURL(new RegExp(materialId));
    await expect(
      page.getByRole('heading', { name: 'Водонапорная башня' }),
      `${width}`,
    ).toBeVisible();
  }

  // The case: the quick note draft moves between the column and the sheet.
  await signInAs(page, player);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/campaigns/${campaignId}/case`);
  const quickNote = page.getByRole('form', { name: 'Быстрая заметка' });
  await quickNote.getByRole('textbox').first().fill('Башня, лестница, полночь');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Быстрая заметка' }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Быстрая заметка' })
      .getByRole('textbox')
      .first(),
  ).toHaveValue('Башня, лестница, полночь');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(quickNote.getByRole('textbox').first()).toHaveValue(
    'Башня, лестница, полночь',
  );
});

test('reduced motion turns animations and the board’s fit into instant changes', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  await createFreeCard(request, owner, campaignId, 'Радиосигнал', {
    x: 0,
    y: 0,
  });
  await createFreeCard(request, owner, campaignId, 'Следы', {
    x: 900,
    y: 500,
  });
  await signInAs(page, owner);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/campaigns/${campaignId}/board`);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);

  const slow = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('body *')]
      .map((element) => {
        const style = getComputedStyle(element);
        const longest = (value: string) =>
          Math.max(...value.split(',').map((part) => parseFloat(part) || 0));
        return {
          name: `${element.tagName}.${element.className}`,
          seconds: Math.max(
            longest(style.transitionDuration),
            style.animationName === 'none'
              ? 0
              : longest(style.animationDuration),
          ),
        };
      })
      .filter(({ seconds }) => seconds > 0.001)
      .map(({ name }) => name),
  );
  expect(slow.slice(0, 5)).toEqual([]);

  // Pan away, then "fit all" lands at once instead of gliding.
  const viewport = page.locator('.react-flow__viewport');
  const pane = page.locator('.react-flow__pane');
  const box = (await pane.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 260, { steps: 5 });
  await page.mouse.up();
  const panned = await viewport.getAttribute('style');
  await page.getByRole('button', { name: 'Вписать всё' }).click();
  const first = await page.evaluate(
    () =>
      new Promise<string | null>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            resolve(
              document
                .querySelector('.react-flow__viewport')!
                .getAttribute('style'),
            ),
          ),
        ),
      ),
  );
  expect(first).not.toBe(panned);
  await page.waitForTimeout(400);
  expect(await viewport.getAttribute('style')).toBe(first);
});

/** WCAG relative luminance of a computed `rgb()` colour. */
function luminance(color: string) {
  const [r, g, b] = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map((part) => {
    const value = Number(part) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

for (const [shade, fill] of [
  ['black', '#000000'],
  ['white', '#ffffff'],
] as const) {
  test(`board text and links stay readable over a ${shade} campaign background`, async ({
    page,
    request,
  }) => {
    const { campaignId, owner } = await createCampaignWithRoles(request);
    const image = await sharp({
      create: { width: 1600, height: 900, channels: 3, background: fill },
    })
      .png()
      .toBuffer();
    await setFixedBackground(request, owner, campaignId, image);
    const first = await createFreeCard(request, owner, campaignId, 'Сигнал', {
      x: 0,
      y: 0,
    });
    const second = await createFreeCard(request, owner, campaignId, 'Башня', {
      x: 420,
      y: 160,
    });
    const link = await request.post(
      `/api/campaigns/${campaignId}/investigation-links`,
      {
        headers: owner.headers,
        data: { cardAId: first, cardBId: second, label: 'в ту же ночь' },
      },
    );
    expect(link.ok()).toBe(true);
    await signInAs(page, owner);

    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto(`/campaigns/${campaignId}/board`);
      await expect(
        page.locator('.campaign-background-layer img'),
      ).toBeVisible();
      await expect(page.locator('.react-flow__edge')).toHaveCount(1);

      // Text never lies on the picture: every text inside the canvas has an
      // opaque surface of its own.
      const bare = await page.evaluate(() => {
        const canvas = document.querySelector('.board-canvas')!;
        const walker = document.createTreeWalker(canvas, NodeFilter.SHOW_TEXT);
        const found: string[] = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node.textContent?.trim();
          const element = node.parentElement;
          if (!text || !element || !element.getClientRects().length) continue;
          // SVG link labels sit on their own filled pill.
          if (element.closest('.react-flow__edge-textwrapper')) continue;
          let backed = false;
          for (
            let parent: Element | null = element;
            parent && parent !== canvas;
            parent = parent.parentElement
          ) {
            const alpha =
              getComputedStyle(parent).backgroundColor.match(/[\d.]+/g);
            if (alpha && (alpha.length < 4 || Number(alpha[3]) >= 0.9)) {
              backed = true;
              break;
            }
          }
          if (!backed) found.push(text.slice(0, 30));
        }
        return found;
      });
      expect(bare, `${colorScheme}: text without a surface`).toEqual([]);

      // A link keeps 3:1 against its halo, whatever the picture is.
      const link = await page
        .locator('.react-flow__edge-path')
        .evaluate((path) => {
          const style = getComputedStyle(path);
          const canvas = getComputedStyle(
            document.querySelector('.board-canvas')!,
          );
          return {
            stroke: style.stroke,
            filter: style.filter,
            halo: canvas.getPropertyValue('--board-bg'),
          };
        });
      expect(link.filter, `${colorScheme}: link halo`).toContain('drop-shadow');
      const halo = await page.evaluate((color) => {
        const probe = document.createElement('span');
        probe.style.color = color;
        document.body.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      }, link.halo);
      expect(
        contrast(link.stroke, halo),
        `${colorScheme}: link contrast`,
      ).toBeGreaterThanOrEqual(3);

      expect(
        await axeViolations(page, '.board-page'),
        `${colorScheme}: axe`,
      ).toEqual([]);
    }
  });
}

test('screens outside the main set pass axe in both variations', async ({
  page,
  request,
}) => {
  test.slow();
  const { campaignId, owner, player, viewer } =
    await createCampaignWithRoles(request);
  const characterId = await createPlayerCharacter(
    request,
    player,
    campaignId,
    'Ольга',
  );
  await createElement(request, owner, campaignId, {
    type: 'NPC',
    title: 'Смотритель Берг',
    typeData: { role: 'Смотритель' },
    access: 'SHARED',
  });
  await createFreeCard(request, owner, campaignId, 'Радиосигнал', {
    x: 0,
    y: 0,
  });

  const check = async (where: string) => {
    expect(await axeViolations(page), where).toEqual([]);
    expect(await iconButtonContrastIssues(page), `${where}: icons`).toEqual([]);
  };

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.context().clearCookies();
    await page.goto('/sign-up');
    await expect(
      page.getByRole('button', { name: 'Создать аккаунт' }),
    ).toBeVisible();
    await check(`sign-up, ${colorScheme}`);

    await signInAs(page, owner);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [where, path, marker] of [
      [
        'materials list',
        `/campaigns/${campaignId}/elements`,
        'Смотритель Берг',
      ],
      ['backgrounds', `/campaigns/${campaignId}/settings/backgrounds`, 'Фоны'],
      [
        'character detail',
        `/campaigns/${campaignId}/characters/${characterId}`,
        'Ольга',
      ],
    ] as const) {
      await page.goto(path);
      await expect(page.getByText(marker).first()).toBeVisible();
      await check(`${where}, ${colorScheme}`);
    }

    // Open panels and dialogs.
    await page.goto(`/campaigns/${campaignId}/board`);
    await page.getByRole('button', { name: 'Новая карточка' }).click();
    await expect(page.getByLabel('Название карточки')).toBeVisible();
    await check(`board inspector, ${colorScheme}`);
    await page.keyboard.press('ControlOrMeta+K');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.type('Берг');
    await check(`search, ${colorScheme}`);
    await page.keyboard.press('Escape');

    await page.setViewportSize({ width: 1100, height: 768 });
    await page.goto(`/campaigns/${campaignId}/members`);
    await expect(
      page.locator('main').getByText('Мастер').first(),
    ).toBeVisible();
    await check(`icon sidebar, ${colorScheme}`);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.getByRole('button', { name: 'Меню' }).click();
    await check(`slide-out menu, ${colorScheme}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/campaigns/${campaignId}/board`);
    await expect(page.getByText('Радиосигнал')).toBeVisible();
    await check(`phone board, ${colorScheme}`);

    // The viewer reads the case and the board.
    await signInAs(page, viewer);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [where, path, marker] of [
      ['viewer case', `/campaigns/${campaignId}/case`, 'Смотритель Берг'],
      ['viewer board', `/campaigns/${campaignId}/board`, 'Радиосигнал'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByText(marker).first()).toBeVisible();
      await check(`${where}, ${colorScheme}`);
    }
  }
});
