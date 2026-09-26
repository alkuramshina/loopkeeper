import { expect, Page, test } from '@playwright/test';
import {
  createCampaign,
  createInvitation,
  PASSWORD,
  registerUser,
  signInAs,
  uniqueEmail,
} from './support/api';

function countRefreshRequests(page: Page) {
  const counter = { value: 0 };
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/auth/refresh'))
      counter.value += 1;
  });
  return counter;
}

test('signs up, restores the session on reload and signs out', async ({ page }) => {
  await page.goto('/sign-up');
  await page.getByLabel('Имя').fill('Новичок');
  await page.getByLabel('Электронная почта').fill(uniqueEmail('signup'));
  await page.getByLabel('Пароль').fill(PASSWORD);
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();

  await expect(page).toHaveURL(/\/campaigns$/);
  await expect(
    page.getByRole('heading', { name: 'Здесь пока нет кампаний' }),
  ).toBeVisible();

  // M1: a reload restores the session with exactly one refresh, even in Strict Mode.
  const refreshes = countRefreshRequests(page);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Здесь пока нет кампаний' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/campaigns$/);
  expect(refreshes.value).toBe(1);

  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Войдите в Loopkeeper' }),
  ).toBeVisible();
});

test('signs in through the form and reports wrong credentials by code', async ({
  page,
  request,
}) => {
  const user = await registerUser(request, 'Входящий');

  await page.goto('/sign-in');
  await page.getByLabel('Электронная почта').fill(user.email);
  await page.getByLabel('Пароль').fill('wrong-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Не удалось войти. Проверьте почту и пароль.',
  );
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByLabel('Пароль').fill(user.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/campaigns$/);
  await expect(page.getByRole('link', { name: user.name })).toBeVisible();
});

test('M2: a lost refresh session redirects to sign-in without a refresh loop', async ({
  page,
  request,
}) => {
  const user = await registerUser(request, 'Потерянный');
  await signInAs(page, user);
  await page.goto('/campaigns');
  await expect(page.getByRole('link', { name: user.name })).toBeVisible();

  await page.context().clearCookies();
  const refreshes = countRefreshRequests(page);
  await page.reload();

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('link', { name: user.name })).toHaveCount(0);
  expect(refreshes.value).toBe(1);
});

test('keeps the invitation through sign-in and joins the campaign', async ({
  page,
  request,
}) => {
  const owner = await registerUser(request, 'Мастер');
  const invited = await registerUser(request, 'Приглашённый');
  const campaignId = await createCampaign(request, owner, 'Кампания по ссылке');
  const token = await createInvitation(request, owner, campaignId, 'PLAYER');

  await page.goto(`/invitations/${token}`);
  await expect(page).toHaveURL(/\/sign-in\?invitation=/);

  await page.getByLabel('Электронная почта').fill(invited.email);
  await page.getByLabel('Пароль').fill(invited.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();

  await expect(page).toHaveURL(`/campaigns/${campaignId}/characters`);
  await expect(
    page.getByRole('heading', { name: 'Кампания по ссылке' }),
  ).toBeVisible();
  await expect(page.getByText('Игрок', { exact: true }).first()).toBeVisible();
});

test('a new user signs up from an invitation link and joins the campaign', async ({
  page,
  request,
}) => {
  const owner = await registerUser(request, 'Мастер');
  const campaignId = await createCampaign(request, owner, 'Кампания для новичка');
  const token = await createInvitation(request, owner, campaignId, 'VIEWER');

  await page.goto(`/invitations/${token}`);
  await page.getByRole('link', { name: 'Создать аккаунт' }).click();
  await expect(page).toHaveURL(/\/sign-up\?invitation=/);

  await page.getByLabel('Имя').fill('Новичок');
  await page.getByLabel('Электронная почта').fill(uniqueEmail('invited'));
  await page.getByLabel('Пароль').fill(PASSWORD);
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();

  await expect(page).toHaveURL(`/campaigns/${campaignId}/characters`);
  await expect(page.getByText('Наблюдатель', { exact: true }).first()).toBeVisible();
});
