import { expect, test } from './support/test';
import { registerUser, signInAs } from './support/api';

test('M9: renames the account and changes the password', async ({
  page,
  request,
}) => {
  const user = await registerUser(request, 'Старое имя');
  await signInAs(page, user);
  await page.goto('/campaigns');
  await page.locator('.sidebar-profile').click();
  await expect(page).toHaveURL(/\/settings\/account$/);
  await expect(page.getByLabel('Электронная почта')).toBeDisabled();
  await expect(page.getByLabel('Электронная почта')).toHaveValue(user.email);

  const profileForm = page.locator('form').filter({ hasText: 'Имя' });
  await profileForm.getByLabel('Имя').fill('Новое имя');
  await profileForm
    .getByRole('button', { name: 'Сохранить изменения' })
    .click();
  await expect(profileForm.getByText('Изменения сохранены')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Имя')).toHaveValue('Новое имя');

  // The password has its own section in the side menu.
  await page
    .getByRole('navigation', { name: 'Разделы настроек' })
    .getByRole('link', { name: 'Вход и пароль' })
    .click();
  await expect(page).toHaveURL(/\/settings\/password$/);

  const passwordForm = page
    .locator('form')
    .filter({ hasText: 'Текущий пароль' });
  const newPassword = 'another-browser-password';
  let changeRequests = 0;
  page.on('request', (outgoing) => {
    if (outgoing.url().endsWith('/api/auth/change-password'))
      changeRequests += 1;
  });

  // Mismatched confirmation is caught before any API request.
  await passwordForm.getByLabel('Текущий пароль').fill(user.password);
  await passwordForm
    .getByLabel('Новый пароль', { exact: true })
    .fill(newPassword);
  await passwordForm
    .getByLabel('Повторите новый пароль')
    .fill('something-else');
  await passwordForm.getByRole('button', { name: 'Изменить пароль' }).click();
  await expect(passwordForm.getByRole('alert')).toHaveText(
    'Новые пароли не совпадают',
  );
  expect(changeRequests).toBe(0);

  await passwordForm.getByLabel('Текущий пароль').fill('not-my-password');
  await passwordForm.getByLabel('Повторите новый пароль').fill(newPassword);
  await passwordForm.getByRole('button', { name: 'Изменить пароль' }).click();
  await expect(passwordForm.getByRole('alert')).toHaveText(
    'Не удалось войти. Проверьте почту и пароль.',
  );
  await expect(page).toHaveURL(/\/settings\/password$/);

  await passwordForm.getByLabel('Текущий пароль').fill(user.password);
  await passwordForm.getByRole('button', { name: 'Изменить пароль' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  const oldLogin = await request.post('/api/auth/login', {
    data: { email: user.email, password: user.password },
  });
  expect(oldLogin.status()).toBe(401);

  await page.getByLabel('Электронная почта').fill(user.email);
  await page.getByLabel('Пароль').fill(newPassword);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/campaigns$/);
  await expect(
    page.locator('.sidebar-profile'),
  ).toBeVisible();
});
