import { expect, Locator, Page, test } from './support/test';
import {
  createCampaignWithRoles,
  createElement,
  createFreeCard,
  createPlayerCharacter,
  signInAs,
} from './support/api';

async function expectNoHorizontalOverflow(page: Page, where: string) {
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => {
        // The board canvas pans by design; only its frame must fit.
        if (element.closest('.react-flow__viewport')) return false;
        // Content of a horizontal scroller (the mobile navigation) is reachable
        // by scrolling. Content clipped by overflow: hidden is still a bug.
        for (
          let parent = element.parentElement;
          parent;
          parent = parent.parentElement
        ) {
          if (['auto', 'scroll'].includes(getComputedStyle(parent).overflowX))
            return false;
        }
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.right > width + 1;
      })
      .map((element) => `${element.tagName}.${element.className}`);
    return { scroll: document.documentElement.scrollWidth - width, wide };
  });
  expect(
    overflow.wide.slice(0, 5),
    `${where}: elements wider than the viewport`,
  ).toEqual([]);
  expect(
    overflow.scroll,
    `${where}: page scrolls horizontally`,
  ).toBeLessThanOrEqual(1);
}

/** The control is on screen and nothing (e.g. the bottom navigation) covers it. */
async function expectClickable(page: Page, control: Locator) {
  await control.scrollIntoViewIfNeeded();
  const box = await control.boundingBox();
  if (!box) throw new Error('Control is not visible');
  const covered = await page.evaluate(
    ({ x, y }) => {
      const hit = document.elementFromPoint(x, y);
      return (
        hit?.closest('button, a, select, input')?.textContent ?? hit?.tagName
      );
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(covered).toBe(await control.textContent());
}

for (const width of [320, 768]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 720 } });

    test('workspace pages fit the screen and dialogs stay usable', async ({
      page,
      request,
    }) => {
      const { campaignId, owner, player } =
        await createCampaignWithRoles(request);
      await createPlayerCharacter(request, player, campaignId, 'Алекс');
      await createFreeCard(
        request,
        owner,
        campaignId,
        'Длинное название улики у самой вышки',
        {
          x: 0,
          y: 0,
        },
      );
      const elementId = await createElement(request, owner, campaignId, {
        type: 'LOCATION',
        title: 'Очень длинное название локации на краю острова',
        content: 'Текст '.repeat(60),
        access: 'SHARED',
      });
      await signInAs(page, owner);

      for (const path of [
        '/campaigns',
        `/campaigns/${campaignId}/characters`,
        `/campaigns/${campaignId}/elements/${elementId}`,
        `/campaigns/${campaignId}/members`,
        `/campaigns/${campaignId}/settings`,
        `/campaigns/${campaignId}/board`,
        '/settings/account',
      ]) {
        await page.goto(path);
        await expect(page.getByText('Загрузка…')).toHaveCount(0);
        await page.waitForLoadState('networkidle');
        await expectNoHorizontalOverflow(page, path);
      }

      // The access switch and actions of an own element wrap instead of overflowing.
      await page.goto(`/campaigns/${campaignId}/elements/${elementId}`);
      await expectClickable(
        page,
        page.getByRole('button', { name: 'Добавить на доску' }),
      );
      await expectClickable(
        page,
        page.getByRole('button', { name: 'Удалить' }).first(),
      );

      // A long form in a dialog scrolls; its save button is not hidden by navigation.
      await page.getByRole('button', { name: 'Редактировать' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expectClickable(
        page,
        dialog.getByRole('button', { name: 'Сохранить' }),
      );
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    });

    test('long dialogs scroll inside the screen and keep their submit button reachable', async ({
      page,
      request,
    }) => {
      const { campaignId, player } = await createCampaignWithRoles(request);
      await createElement(request, player, campaignId, {
        type: 'NOTE',
        title: 'Заметка игрока',
        access: 'SHARED',
      });
      await signInAs(page, player);

      const dialogs: [string, string, string, string][] = [
        ['/campaigns', 'Новая кампания', 'Новая кампания', 'Создать кампанию'],
        [
          `/campaigns/${campaignId}/characters`,
          'Создать персонажа',
          'Новый персонаж',
          'Создать персонажа',
        ],
        [
          `/campaigns/${campaignId}/elements`,
          'Новая заметка',
          'Новый элемент',
          'Сохранить',
        ],
      ];
      for (const [path, opener, title, submit] of dialogs) {
        await page.goto(path);
        await page.getByRole('button', { name: opener }).first().click();
        const dialog = page.getByRole('dialog', { name: title });
        await expect(dialog).toBeVisible();
        const fits = await dialog.evaluate((node) => {
          const box = node.getBoundingClientRect();
          return (
            box.top >= 0 &&
            box.bottom <= window.innerHeight &&
            box.left >= 0 &&
            box.right <= window.innerWidth
          );
        });
        expect(fits, `${title}: the dialog fits the viewport`).toBe(true);
        await expectClickable(
          page,
          dialog.getByRole('button', { name: submit }).last(),
        );
        await expectNoHorizontalOverflow(page, `${title} dialog`);
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
      }

      // A player's own note: the access switch and actions wrap on screen.
      await page.goto(`/campaigns/${campaignId}/elements`);
      await page.getByRole('link', { name: /Заметка игрока/ }).click();
      await expectNoHorizontalOverflow(page, 'player note');
      await expectClickable(
        page,
        page.getByRole('button', { name: 'Редактировать' }),
      );
      for (const control of [
        page.locator('.note-detail').getByLabel('Доступ'),
        page.getByLabel('Обложка'),
      ]) {
        await control.scrollIntoViewIfNeeded();
        await expect(control).toBeInViewport({ ratio: 1 });
      }
    });
  });
}
