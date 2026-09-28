import { expect, Page, test } from './support/test';
import {
  createCampaign,
  listCampaignTitles,
  registerUser,
  signInAs,
} from './support/api';

async function createInvitationLink(page: Page, role: 'PLAYER' | 'VIEWER') {
  await page.getByRole('button', { name: 'Создать приглашение' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Роль').selectOption(role);
  await dialog.getByRole('button', { name: 'Создать приглашение' }).click();
  const link = await page.locator('.created-invitation code').textContent();
  if (!link) throw new Error('The invitation link is not shown');
  return new URL(link).pathname;
}

function memberSaved(page: Page, method: 'PATCH' | 'DELETE') {
  return page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      response.url().includes('/members/') &&
      response.ok(),
  );
}

test('the master invites a player, changes the role and removes the member', async ({
  browser,
  page,
  request,
}) => {
  const owner = await registerUser(request, 'Мастер');
  const member = await registerUser(request, 'Ким');
  const campaignId = await createCampaign(request, owner, 'Сигнал из леса');
  const membersPage = `/campaigns/${campaignId}/members`;

  await signInAs(page, owner);
  await page.goto(membersPage);
  await expect(
    page.getByText('Кроме мастера в кампании пока никого нет.'),
  ).toBeVisible();
  await page
    .getByRole('group', { name: 'Участники' })
    .getByRole('link', { name: 'Приглашения' })
    .click();
  await expect(page).toHaveURL(`/campaigns/${campaignId}/invitations`);
  const invitationPath = await createInvitationLink(page, 'PLAYER');
  await expect(page.getByText('Активно')).toBeVisible();

  // The invited user follows the link and lands in the campaign as a player.
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await signInAs(memberPage, member);
  await memberPage.goto(invitationPath);
  await expect(memberPage).toHaveURL(
    new RegExp(`/campaigns/${campaignId}(/[a-z]+)?$`),
  );
  await memberPage.goto(`/campaigns/${campaignId}/notes`);
  await expect(
    memberPage.getByRole('button', { name: 'Заметка', exact: true }),
  ).toBeVisible();

  // The accepted invitation names who used it.
  await page.reload();
  const accepted = page.locator('.member-row').filter({ hasText: 'Принято' });
  await expect(accepted).toContainText('Кто принял');
  await expect(accepted).toContainText('Ким');

  await page.goto(membersPage);
  const role = page.getByLabel('Роль для Ким');
  await expect(role).toHaveValue('PLAYER');

  // Demoted to viewer: the member can no longer write notes.
  const demoted = memberSaved(page, 'PATCH');
  await role.selectOption('VIEWER');
  await demoted;
  await memberPage.reload();
  await expect(memberPage).toHaveURL(
    new RegExp(`/campaigns/${campaignId}/case$`),
  );
  await expect(
    memberPage.getByRole('heading', { name: 'Дело', exact: true }),
  ).toBeVisible();
  await expect(
    memberPage.getByRole('link', { name: 'Мои заметки' }),
  ).toHaveCount(0);

  // Removal asks for confirmation and takes the campaign away from the member.
  page.once('dialog', (confirm) => void confirm.dismiss());
  await page.getByRole('button', { name: 'Удалить' }).click();
  await expect(role).toBeVisible();

  page.once('dialog', (confirm) => void confirm.accept());
  const removed = memberSaved(page, 'DELETE');
  await page.getByRole('button', { name: 'Удалить' }).click();
  await removed;
  await expect(
    page.getByText('Кроме мастера в кампании пока никого нет.'),
  ).toBeVisible();

  expect(await listCampaignTitles(request, member)).toEqual([]);
  await memberPage.goto('/campaigns');
  await expect(memberPage.getByText('Здесь пока нет кампаний')).toBeVisible();
  await memberPage.goto(`/campaigns/${campaignId}/board`);
  await expect(memberPage.getByRole('alert')).toHaveText(
    'Этот ресурс недоступен.',
  );
});

test('a revoked invitation link no longer works', async ({
  browser,
  page,
  request,
}) => {
  const owner = await registerUser(request, 'Мастер');
  const latecomer = await registerUser(request, 'Опоздавший');
  const campaignId = await createCampaign(request, owner);

  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/invitations`);
  const invitationPath = await createInvitationLink(page, 'VIEWER');

  page.once('dialog', (confirm) => void confirm.accept());
  await page.getByRole('button', { name: 'Отозвать' }).click();
  await expect(page.getByText('Отозвано')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Отозвать' })).toHaveCount(0);

  const context = await browser.newContext();
  const latecomerPage = await context.newPage();
  await signInAs(latecomerPage, latecomer);
  await latecomerPage.goto(invitationPath);
  await expect(latecomerPage.getByRole('alert')).toHaveText(
    'Приглашение недоступно.',
  );
  expect(await listCampaignTitles(request, latecomer)).toEqual([]);
});

test('members and invitations are separate screens; the master row cannot be managed', async ({
  page,
  request,
}) => {
  const owner = await registerUser(request, 'Мастер');
  const campaignId = await createCampaign(request, owner);
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/members`);

  await expect(
    page.getByRole('heading', { level: 1, name: 'Участники' }),
  ).toBeVisible();
  // Invitations are not on the members screen.
  await expect(
    page.getByRole('button', { name: 'Создать приглашение' }),
  ).toHaveCount(0);
  // Joining is invitation-only: there is no email lookup or direct add.
  await expect(page.locator('input[type=email]')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Добавить участника' }),
  ).toHaveCount(0);

  const rows = page.locator('.member-row');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Мастер');
  await expect(rows.first().locator('.role-badge')).toHaveText('Мастер');
  await expect(rows.first().locator('select, button')).toHaveCount(0);
  await expect(
    page.getByText('Кроме мастера в кампании пока никого нет.'),
  ).toBeVisible();

  await page.goto(`/campaigns/${campaignId}/invitations`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Приглашения' }),
  ).toBeVisible();
  await expect(
    page.getByText('Активных и завершённых приглашений пока нет.'),
  ).toBeVisible();
  await expect(page.locator('.member-row')).toHaveCount(0);
});

test('the copied invitation link lets a second account join only this campaign', async ({
  browser,
  context,
  page,
  request,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const owner = await registerUser(request, 'Мастер');
  const player = await registerUser(request, 'Лена');
  const campaignId = await createCampaign(request, owner, 'Сигнал');
  await createCampaign(request, owner, 'Другая кампания');

  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/invitations`);
  await createInvitationLink(page, 'PLAYER');
  await page
    .locator('.created-invitation')
    .getByRole('button', { name: 'Скопировать ссылку' })
    .click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/\/invitations\/[^/]+$/);
  expect(copied).toBe(
    await page.locator('.created-invitation code').textContent(),
  );

  // Coming back later, the master can still copy the same active link.
  await page.reload();
  await page.evaluate(() => navigator.clipboard.writeText(''));
  await page.getByRole('button', { name: 'Скопировать ссылку' }).click();
  await expect(page.getByRole('button', { name: 'Скопировано' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    copied,
  );

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await signInAs(playerPage, player);
  await playerPage.goto(new URL(copied).pathname);
  await expect(playerPage).toHaveURL(
    new RegExp(`/campaigns/${campaignId}(/[a-z]+)?$`),
  );
  await playerPage.goto('/campaigns');
  await expect(playerPage.locator('.campaign-card')).toHaveCount(1);
  await expect(playerPage.locator('.campaign-card')).toContainText('Сигнал');
  await expect(playerPage.locator('.campaign-card')).toContainText('Игрок');
  expect(await listCampaignTitles(request, player)).toEqual(['Сигнал']);
  await playerContext.close();
});
