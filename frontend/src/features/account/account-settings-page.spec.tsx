import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { ApiError } from '../../api/client';
import {
  AccountSettingsPage,
  PasswordSettingsPage,
} from './account-settings-page';

const request = vi.fn();
const signOut = vi.fn();
const updateProfile = vi.fn();
// Like the real context, a saved profile is what the next render reads.
const profile = { userId: 'user-1', email: 'user@example.test', name: 'Алекс' };
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({ api: { request }, profile, signOut, updateProfile }),
}));

function renderPage(path = '/settings/account') {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/settings/account" element={<AccountSettingsPage />} />
          <Route path="/settings/password" element={<PasswordSettingsPage />} />
          <Route path="/sign-in" element={<p>Страница входа</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function fillPasswords(current: string, next: string, confirmation: string) {
  fireEvent.change(screen.getByLabelText('Текущий пароль'), {
    target: { value: current },
  });
  fireEvent.change(screen.getByLabelText('Новый пароль'), {
    target: { value: next },
  });
  fireEvent.change(screen.getByLabelText('Повторите новый пароль'), {
    target: { value: confirmation },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Изменить пароль' }));
}

describe('AccountSettingsPage', () => {
  beforeEach(() => {
    request.mockReset();
    request.mockImplementation((path: string) =>
      path === '/campaigns' ? Promise.resolve([]) : undefined,
    );
    signOut.mockReset();
    updateProfile.mockReset();
    profile.name = 'Алекс';
  });

  it('switches between the settings and the password from the side menu', async () => {
    renderPage();
    const navigation = screen.getByRole('navigation', {
      name: 'Разделы настроек',
    });

    expect(screen.getByRole('link', { name: 'Профиль' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(navigation).toContainElement(
      screen.getByRole('link', { name: 'Вход и пароль' }),
    );
    expect(screen.queryByLabelText('Текущий пароль')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Вход и пароль' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Вход и пароль' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Текущий пароль')).toBeInTheDocument();
  });

  it('shows the email read-only and saves a trimmed name', async () => {
    updateProfile.mockImplementation(({ name }: { name: string }) => {
      profile.name = name;
      return Promise.resolve();
    });
    renderPage();

    expect(screen.getByLabelText('Электронная почта')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Имя'), {
      target: { value: '  Мира  ' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Сохранить изменения' }),
    );

    expect(await screen.findByText('Изменения сохранены')).toBeInTheDocument();
    expect(updateProfile).toHaveBeenCalledWith({ name: 'Мира' });
  });

  it('catches mismatched passwords before calling the API', () => {
    renderPage('/settings/password');

    fillPasswords('current-password', 'new-password-1', 'new-password-2');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Новые пароли не совпадают',
    );
    expect(
      request.mock.calls.filter(([path]) => path === '/auth/change-password'),
    ).toHaveLength(0);
  });

  it('shows a localized error for a wrong current password', async () => {
    request.mockRejectedValue(
      new ApiError(
        401,
        'auth.invalid_credentials',
        'Invalid current password',
        undefined,
      ),
    );
    renderPage('/settings/password');

    fillPasswords('wrong-password', 'new-password-1', 'new-password-1');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось войти. Проверьте почту и пароль.',
    );
    expect(signOut).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Изменить пароль' }),
    ).toBeEnabled();
  });

  it('signs out and returns to sign-in after a password change', async () => {
    request.mockResolvedValue(undefined);
    signOut.mockResolvedValue(undefined);
    renderPage('/settings/password');

    fillPasswords('current-password', 'new-password-1', 'new-password-1');

    expect(await screen.findByText('Страница входа')).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: 'current-password',
        newPassword: 'new-password-1',
      }),
    });
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });
});
