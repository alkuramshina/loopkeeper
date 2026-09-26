import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { ApiError } from '../../api/client';
import { AccountSettingsPage } from './account-settings-page';

const request = vi.fn();
const signOut = vi.fn();
const updateProfile = vi.fn();
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({
    api: { request },
    profile: { userId: 'user-1', email: 'user@example.test', name: 'Алекс' },
    signOut,
    updateProfile,
  }),
}));

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/settings/account']}>
      <Routes>
        <Route path="/settings/account" element={<AccountSettingsPage />} />
        <Route path="/sign-in" element={<p>Страница входа</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function fillPasswords(current: string, next: string, confirmation: string) {
  fireEvent.change(screen.getByLabelText('Текущий пароль'), {
    target: { value: current },
  });
  fireEvent.change(screen.getByLabelText('Новый пароль'), { target: { value: next } });
  fireEvent.change(screen.getByLabelText('Повторите новый пароль'), {
    target: { value: confirmation },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Изменить пароль' }));
}

describe('AccountSettingsPage', () => {
  beforeEach(() => {
    request.mockReset();
    signOut.mockReset();
    updateProfile.mockReset();
  });

  it('shows the email read-only and saves a trimmed name', async () => {
    updateProfile.mockResolvedValue(undefined);
    renderPage();

    expect(screen.getByLabelText('Электронная почта')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Имя'), { target: { value: '  Мира  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Сохранено')).toBeInTheDocument();
    expect(updateProfile).toHaveBeenCalledWith({ name: 'Мира' });
  });

  it('catches mismatched passwords before calling the API', () => {
    renderPage();

    fillPasswords('current-password', 'new-password-1', 'new-password-2');

    expect(screen.getByRole('alert')).toHaveTextContent('Новые пароли не совпадают');
    expect(request).not.toHaveBeenCalled();
  });

  it('shows a localized error for a wrong current password', async () => {
    request.mockRejectedValue(
      new ApiError(401, 'auth.invalid_credentials', 'Invalid current password', undefined),
    );
    renderPage();

    fillPasswords('wrong-password', 'new-password-1', 'new-password-1');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось войти. Проверьте почту и пароль.',
    );
    expect(signOut).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Изменить пароль' })).toBeEnabled();
  });

  it('signs out and returns to sign-in after a password change', async () => {
    request.mockResolvedValue(undefined);
    signOut.mockResolvedValue(undefined);
    renderPage();

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
