import { expect, test } from './support/test';
import { createCampaignWithRoles, signInAs } from './support/api';

test('F13g: owner previews a 16:9 background and saves random session selection', async ({
  page,
  request,
}) => {
  const { campaignId, owner } = await createCampaignWithRoles(request);
  await signInAs(page, owner);
  await page.goto(`/campaigns/${campaignId}/settings/backgrounds`);
  await page.getByRole('button', { name: 'Добавить фон' }).click();
  await page.getByLabel('Название').fill('Озеро');
  await page
    .getByLabel('HTTPS-адрес изображения или локальный файл')
    .fill('https://example.com/lake.jpg');
  await expect(page.getByLabel('Предпросмотр фона')).toBeVisible();
  await page.getByLabel('Способ выбора').selectOption('RANDOM');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.reload();
  await expect(page.getByLabel('Способ выбора')).toHaveValue('RANDOM');
  await expect(page.getByLabel('Предпросмотр фона')).toBeVisible();
  const preview = page.getByLabel('Предпросмотр фона');
  const box = await preview.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(16 / 9, 1);
});
