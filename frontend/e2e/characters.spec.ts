import { expect, test } from '@playwright/test';
import {
  addMember,
  createCampaignWithRoles,
  createPlayerCharacter,
  registerUser,
  signInAs,
} from './support/api';

const createButton = 'Создать персонажа';

test('M8: only a player without an active character is offered to create one', async ({
  browser,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  const secondPlayer = await registerUser(request, 'Второй игрок');
  await addMember(request, owner, campaignId, secondPlayer, 'PLAYER');
  await createPlayerCharacter(request, player, campaignId, 'Алекс');

  const expectations = [
    { user: player, offered: false },
    { user: secondPlayer, offered: true },
    { user: owner, offered: false },
  ];
  for (const { user, offered } of expectations) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signInAs(page, user);
    await page.goto(`/campaigns/${campaignId}/characters`);
    await expect(page.getByRole('heading', { name: 'Алекс' })).toBeVisible();
    await expect(page.getByRole('button', { name: createButton })).toHaveCount(
      offered ? 1 : 0,
    );
    await context.close();
  }
});
