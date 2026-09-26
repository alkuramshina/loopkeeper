import { expect, test } from '@playwright/test';
import {
  createCampaignWithRoles,
  createElement,
  createPlayerCharacter,
  signInAs,
} from './support/api';

const markdown = [
  '# Дневник',
  '',
  '1. Первый пункт',
  '2. Второй пункт',
  '',
  '> Цитата сторожа',
  '',
  '**важно** и `код`',
  '',
  '[карта](https://example.com/map) [опасно](javascript:alert(1))',
  '',
  '<b>сырой html</b><script>window.injected = true</script>',
  '',
  '![картинка](https://example.com/tracker.png)',
].join('\n');

test('M12: a note renders safe Markdown and never raw HTML', async ({ page, request }) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  const elementId = await createElement(request, owner, campaignId, {
    type: 'NOTE',
    title: 'Записи',
    content: markdown,
    access: 'SHARED',
  });
  await signInAs(page, player);
  await page.goto(`/campaigns/${campaignId}/elements/${elementId}`);

  const body = page.locator('.note-detail .markdown-preview');
  await expect(body.getByRole('heading', { name: 'Дневник' })).toBeVisible();
  await expect(body.locator('ol > li')).toHaveText(['Первый пункт', 'Второй пункт']);
  await expect(body.locator('blockquote')).toHaveText('Цитата сторожа');
  await expect(body.locator('strong')).toHaveText('важно');
  await expect(body.locator('code')).toHaveText('код');

  const safe = body.getByRole('link', { name: 'карта' });
  await expect(safe).toHaveAttribute('href', 'https://example.com/map');
  await expect(safe).toHaveAttribute('target', '_blank');
  await expect(safe).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(body.getByText('опасно')).not.toHaveAttribute('href', /javascript/);

  // Raw HTML stays text, scripts never run, remote images are not loaded.
  await expect(body.locator('b')).toHaveCount(0);
  await expect(body.locator('script')).toHaveCount(0);
  await expect(body.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => 'injected' in window)).toBe(false);
});

test('M12: fallback avatars are generated locally, without third-party requests', async ({
  page,
  request,
}) => {
  const { campaignId, owner, player } = await createCampaignWithRoles(request);
  await createPlayerCharacter(request, player, campaignId, 'Алекс');
  const external: string[] = [];
  page.on('request', (outgoing) => {
    if (!outgoing.url().startsWith('http://localhost')) external.push(outgoing.url());
  });

  await signInAs(page, owner);
  for (const section of ['characters', 'members']) {
    await page.goto(`/campaigns/${campaignId}/${section}`);
    const fallbacks = page.locator('img.avatar');
    await expect(fallbacks.first()).toBeVisible();
    for (const src of await fallbacks.evaluateAll((images) =>
      images.map((image) => image.getAttribute('src')),
    )) {
      expect(src).toMatch(/^data:image\/svg\+xml/);
    }
  }
  await expect(page.getByRole('img', { name: 'Игрок' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Наблюдатель' })).toBeVisible();

  // The same entity keeps the same fallback across visits.
  const before = await page.getByRole('img', { name: 'Игрок' }).getAttribute('src');
  await page.reload();
  await expect(page.getByRole('img', { name: 'Игрок' })).toHaveAttribute('src', before!);
  expect(external.filter((url) => !url.startsWith('data:'))).toEqual([]);
});
