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
  // Native scrolling accounts for the fixed mobile navigation only when the
  // target is placed above the viewport edge, not merely intersecting it.
  await control.evaluate((element) =>
    element.scrollIntoView({ block: 'center' }),
  );
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

// Every layout range from the redesign plan, plus low laptop screens where
// headers and bottom bars eat the working area. Long dialogs are checked where
// the height is tight.
const viewports = [
  { width: 320, height: 720, dialogs: true },
  { width: 390, height: 844, dialogs: false },
  { width: 768, height: 720, dialogs: true },
  { width: 1024, height: 768, dialogs: false },
  { width: 1280, height: 720, dialogs: true },
  { width: 1366, height: 768, dialogs: false },
  { width: 1440, height: 900, dialogs: false },
  { width: 1920, height: 1080, dialogs: false },
];

for (const { width, height, dialogs } of viewports) {
  test.describe(`${width}×${height}`, () => {
    test.use({ viewport: { width, height } });

    test('workspace pages fit the screen and dialogs stay usable', async ({
      page,
      request,
    }) => {
      for (const path of ['/sign-in', '/sign-up']) {
        await page.goto(path);
        await expect(page.getByLabel('Пароль')).toBeVisible();
        await expectNoHorizontalOverflow(page, path);
      }

      const { campaignId, owner, player } =
        await createCampaignWithRoles(request);
      const characterId = await createPlayerCharacter(
        request,
        player,
        campaignId,
        'Алекс',
      );
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
        `/campaigns/${campaignId}/characters/${characterId}`,
        `/campaigns/${campaignId}/elements`,
        `/campaigns/${campaignId}/elements/${elementId}`,
        `/campaigns/${campaignId}/members`,
        `/campaigns/${campaignId}/invitations`,
        `/campaigns/${campaignId}/settings`,
        `/campaigns/${campaignId}/settings/cover`,
        `/campaigns/${campaignId}/settings/delete`,
        `/campaigns/${campaignId}/board`,
        '/settings/account',
      ]) {
        await page.goto(path);
        await expect(page.getByText('Загрузка…')).toHaveCount(0);
        await page.waitForLoadState('networkidle');
        await expectNoHorizontalOverflow(page, path);
      }

      // The status and actions of an own material wrap instead of overflowing.
      await page.goto(`/campaigns/${campaignId}/elements/${elementId}`);
      for (const name of ['Скрыть от игроков…', 'Изменить', 'Ещё действия'])
        await expectClickable(page, page.getByRole('button', { name }));

      // The hide dialog fits; its confirmation is not hidden by navigation.
      await page.getByRole('button', { name: 'Скрыть от игроков…' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expectClickable(
        page,
        dialog.getByRole('button', { name: 'Скрыть от игроков', exact: true }),
      );
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    });

    test('the player’s case, reading and notes fit the screen', async ({
      page,
      request,
    }) => {
      const { campaignId, owner, player } =
        await createCampaignWithRoles(request);
      await createPlayerCharacter(request, player, campaignId, 'Майя');
      const materialId = await createElement(request, owner, campaignId, {
        type: 'LOCATION',
        title: 'Трансформаторная будка на краю поля у старой дороги',
        content: 'Дверь заперта снаружи. '.repeat(30),
        access: 'SHARED',
      });
      await createElement(request, owner, campaignId, {
        type: 'NPC',
        title: 'Смотритель Берг',
        typeData: { role: 'Смотритель' },
        access: 'SHARED',
      });
      const noteId = await createElement(request, player, campaignId, {
        type: 'NOTE',
        title: 'Кто взял ключ в 23:40? Спросить у Рикарды',
        content: 'Текст '.repeat(40),
      });
      await signInAs(page, player);

      for (const path of [
        `/campaigns/${campaignId}/case`,
        `/campaigns/${campaignId}/case/${materialId}`,
        `/campaigns/${campaignId}/notes`,
        `/campaigns/${campaignId}/notes/${noteId}`,
      ]) {
        await page.goto(path);
        await expect(page.getByText('Загрузка…')).toHaveCount(0);
        await page.waitForLoadState('networkidle');
        await expectNoHorizontalOverflow(page, path);
      }

      // The reader's actions stay above the bottom navigation.
      await page.goto(`/campaigns/${campaignId}/case/${materialId}`);
      for (const name of ['Добавить на доску', 'Заметка'])
        await expectClickable(
          page,
          page.getByRole('button', { name, exact: true }),
        );

      // The quick note is always one step away: in the side column or, on a
      // phone, behind a button above the navigation.
      await page.goto(`/campaigns/${campaignId}/case`);
      const quickNote = page.getByRole('form', { name: 'Быстрая заметка' });
      if (width < 600) {
        await expect(quickNote).toBeHidden();
        await expectClickable(
          page,
          page.getByRole('button', { name: 'Быстрая заметка' }),
        );
      } else {
        await expect(quickNote).toBeVisible();
      }
    });

    if (!dialogs) return;

    test('long dialogs scroll inside the screen and keep their submit button reachable', async ({
      page,
      request,
    }) => {
      const { campaignId, owner, player } =
        await createCampaignWithRoles(request);
      const noteId = await createElement(request, player, campaignId, {
        type: 'NOTE',
        title: 'Заметка игрока',
        access: 'SHARED',
      });
      const materialId = await createElement(request, owner, campaignId, {
        type: 'LOCATION',
        title: 'Будка',
        content: 'Текст '.repeat(80),
        access: 'SHARED',
      });
      await signInAs(page, player);

      const dialogs: [string, string, string, string][] = [
        ['/campaigns', 'Создать кампанию', 'Новая кампания', 'Создать'],
        // Reading a material, the quick note opens as a sheet on a phone.
        [
          `/campaigns/${campaignId}/case/${materialId}`,
          'Заметка',
          'Быстрая заметка',
          'Сохранить заметку',
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

      // The case and a player's own note: visibility and actions wrap on
      // screen.
      await page.goto(`/campaigns/${campaignId}/case`);
      await expect(
        page.getByRole('heading', { name: 'Дело', exact: true }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page, 'case');
      await page.goto(`/campaigns/${campaignId}/notes/${noteId}`);
      await expect(page.getByLabel('Название')).toHaveValue('Заметка игрока');
      await expectNoHorizontalOverflow(page, 'player note editor');
      for (const name of ['Добавить на доску', 'Ещё действия'])
        await expectClickable(page, page.getByRole('button', { name }));
      for (const control of [
        page.getByRole('radiogroup', { name: 'Кто видит' }),
        page.getByLabel('Обложка'),
      ]) {
        await control.scrollIntoViewIfNeeded();
        await expect(control).toBeInViewport({ ratio: 1 });
      }
    });
  });
}
