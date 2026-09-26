import { expect, test } from '@playwright/test';
import {
  addMember,
  createCampaign,
  createInvitation,
  registerUser,
  signInAs,
} from './support/api';

test('M4: accepts an invitation exactly once under Strict Mode', async ({
  page,
  request,
}) => {
  const owner = await registerUser(request, 'Мастер');
  const player = await registerUser(request, 'Игрок');
  const campaignId = await createCampaign(request, owner);
  const token = await createInvitation(request, owner, campaignId, 'PLAYER');
  let accepts = 0;
  page.on('request', (outgoing) => {
    if (outgoing.method() === 'POST' && outgoing.url().endsWith('/accept'))
      accepts += 1;
  });

  await signInAs(page, player);
  await page.goto(`/invitations/${token}`);

  await expect(page).toHaveURL(`/campaigns/${campaignId}/characters`);
  expect(accepts).toBe(1);

  // Replace navigation: going back must not return to the accept screen.
  await page.goBack();
  await expect(page).not.toHaveURL(/\/invitations\//);
});

test('an existing member sees the localized already-member message', async ({
  page,
  request,
}) => {
  const owner = await registerUser(request, 'Мастер');
  const player = await registerUser(request, 'Игрок');
  const campaignId = await createCampaign(request, owner);
  await addMember(request, owner, campaignId, player, 'PLAYER');
  const secondToken = await createInvitation(request, owner, campaignId, 'VIEWER');

  await signInAs(page, player);
  await page.goto(`/invitations/${secondToken}`);

  await expect(page.getByRole('alert')).toHaveText(
    'Вы уже состоите в этой кампании.',
  );
  await page.getByRole('link', { name: 'Кампании' }).click();
  await expect(page).toHaveURL(/\/campaigns$/);
});

test('a used invitation shows a neutral unavailable state to another account', async ({
  page,
  request,
}) => {
  const owner = await registerUser(request, 'Мастер');
  const first = await registerUser(request, 'Первый');
  const late = await registerUser(request, 'Опоздавший');
  const campaignId = await createCampaign(request, owner, 'Закрытая кампания');
  const token = await createInvitation(request, owner, campaignId, 'PLAYER');
  await request.post(`/api/invitations/${token}/accept`, {
    headers: first.headers,
  });

  await signInAs(page, late);
  await page.goto(`/invitations/${token}`);

  await expect(page.getByRole('alert')).toHaveText('Приглашение недоступно.');
  await page.goto('/campaigns');
  await expect(page.getByText('Закрытая кампания')).toHaveCount(0);
});
