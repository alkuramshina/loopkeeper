import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { ApiError } from '../api/client';
import { AuthPage } from './auth-page';

const signIn = vi.fn();
const signUp = vi.fn();
vi.mock('./auth-context', () => ({
  useAuth: () => ({ signIn, signUp }),
}));

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname + location.search}</p>;
}

function renderAuth(entry: string) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/sign-in" element={<AuthPage mode="sign-in" />} />
        <Route path="/sign-up" element={<AuthPage mode="sign-up" />} />
        <Route path="*" element={null} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('AuthPage', () => {
  beforeEach(() => {
    signIn.mockReset();
    signUp.mockReset();
    window.sessionStorage.clear();
  });

  it('translates a sign-in failure by its code and keeps the form usable', async () => {
    signIn.mockRejectedValue(
      new ApiError(401, 'auth.invalid_credentials', 'Invalid credentials', undefined),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderAuth('/sign-in');

    fireEvent.change(screen.getByLabelText('Электронная почта'), {
      target: { value: 'user@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Пароль'), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось войти. Проверьте почту и пароль.',
    );
    expect(signIn).toHaveBeenCalledWith({
      email: 'user@example.test',
      password: 'wrong-password',
      name: undefined,
    });
    expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled();
  });

  it('keeps the email but clears the password when switching forms', async () => {
    renderAuth('/sign-in');
    fireEvent.change(screen.getByLabelText('Электронная почта'), {
      target: { value: 'user@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Пароль'), {
      target: { value: 'secret-password' },
    });

    fireEvent.click(screen.getByRole('link', { name: 'Создать аккаунт' }));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/sign-up'),
    );
    expect(screen.getByLabelText('Электронная почта')).toHaveValue('user@example.test');
    expect(screen.getByLabelText(/Пароль/)).toHaveValue('');
  });

  it('carries a pending invitation over to the other auth form', () => {
    renderAuth('/sign-in?invitation=token-1');

    expect(screen.getByRole('link', { name: 'Создать аккаунт' })).toHaveAttribute(
      'href',
      '/sign-up?invitation=token-1',
    );
  });

  it('accepts an invitation link or bare token and rejects nested paths', () => {
    renderAuth('/sign-in');
    fireEvent.click(screen.getByRole('button', { name: 'Использовать приглашение' }));
    const input = screen.getByLabelText('Ссылка или токен приглашения');

    fireEvent.change(input, { target: { value: '/invitations/a/b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Вставьте корректную ссылку или токен приглашения.',
    );

    fireEvent.change(input, {
      target: { value: 'https://loopkeeper.test/invitations/token-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/invitations/token-2');
  });

  it('keeps the brand copy variant stable within the tab', () => {
    renderAuth('/sign-in');
    const variant = window.sessionStorage.getItem('loopkeeper.auth-brand-variant');

    expect(variant).toMatch(/^(focus|threads|table)$/);
    fireEvent.click(screen.getByRole('link', { name: 'Создать аккаунт' }));
    expect(window.sessionStorage.getItem('loopkeeper.auth-brand-variant')).toBe(variant);
  });
});
