import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import { ApiError } from '../api/client';
import { AuthPage } from './auth-page';
import { brandImageKeys, brandVariantKeys } from './auth-layout';

const signIn = vi.fn();
const signUp = vi.fn();
const request = vi.fn();
vi.mock('./auth-context', () => ({
  useAuth: () => ({ api: { request }, signIn, signUp }),
}));

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname + location.search}</p>;
}

function renderAuth(entry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/sign-in" element={<AuthPage mode="sign-in" />} />
          <Route path="/sign-up" element={<AuthPage mode="sign-up" />} />
          <Route path="*" element={null} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Math.random() in [index / length, (index + 1) / length) picks that index.
function pickIndex(index: number, length: number) {
  return (index + 0.5) / length;
}

describe('AuthPage', () => {
  beforeEach(() => {
    signIn.mockReset();
    signUp.mockReset();
    request.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('translates a sign-in failure by its code and keeps the form usable', async () => {
    signIn.mockRejectedValue(
      new ApiError(
        401,
        'auth.invalid_credentials',
        'Invalid credentials',
        undefined,
      ),
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
    expect(screen.getByLabelText('Электронная почта')).toHaveValue(
      'user@example.test',
    );
    expect(screen.getByLabelText(/Пароль/)).toHaveValue('');
  });

  it('carries a pending invitation over to the other auth form', () => {
    renderAuth('/sign-in?invitation=token-1');

    expect(
      screen.getByRole('link', { name: 'Создать аккаунт' }),
    ).toHaveAttribute('href', '/sign-up?invitation=token-1');
  });

  it('shows who sent a pending invitation instead of the intro', async () => {
    request.mockResolvedValue({
      campaignTitle: 'Тайна озера',
      masterName: 'Анна',
      role: 'PLAYER',
    });
    renderAuth('/sign-in?invitation=token-1');

    expect(
      await screen.findByText(/Анна приглашает вас в кампанию «Тайна озера»/),
    ).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith('/invitations/token-1');
    expect(
      screen.queryByText(i18n.t('auth.signInIntro')),
    ).not.toBeInTheDocument();
  });

  it('warns when the invitation can no longer be used', async () => {
    request.mockRejectedValue(
      new ApiError(
        404,
        'invitation.not_found',
        'Invitation not found',
        undefined,
      ),
    );
    renderAuth('/sign-up?invitation=token-1');

    expect(
      await screen.findByText(i18n.t('auth.invitationUnavailable')),
    ).toBeInTheDocument();
  });

  it('mentions no invitations on a plain sign-in', () => {
    renderAuth('/sign-in');

    expect(screen.getByText(i18n.t('auth.signInIntro'))).toBeInTheDocument();
    expect(screen.queryByText(/приглаш/i)).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('keeps the whole brand panel when switching forms', async () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(pickIndex(1, brandVariantKeys.length))
      .mockReturnValueOnce(pickIndex(2, brandImageKeys.length));
    renderAuth('/sign-in');
    const panel = () => document.querySelector('.auth-brand');
    const signInPanel = panel()?.innerHTML;

    expect(document.querySelector('.auth-brand-image')).toHaveAttribute(
      'src',
      expect.stringContaining('bridge-winter.png'),
    );
    expect(
      screen.getByText(i18n.t('auth.brandVariants.threads.title')),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Создать аккаунт' }));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/sign-up'),
    );
    expect(panel()?.innerHTML).toBe(signInPanel);
  });

  it('picks a new image on the next page load', () => {
    vi.spyOn(Math, 'random').mockReturnValue(pickIndex(0, 4));
    const first = renderAuth('/sign-in');
    expect(document.querySelector('.auth-brand-image')).toHaveAttribute(
      'data-variant',
      'lake',
    );
    first.unmount();

    vi.spyOn(Math, 'random').mockReturnValue(pickIndex(3, 4));
    renderAuth('/sign-in');
    expect(document.querySelector('.auth-brand-image')).toHaveAttribute(
      'data-variant',
      'radio',
    );
  });

  it('keeps the form title as the only top-level heading', () => {
    renderAuth('/sign-in');

    expect(screen.getAllByRole('heading', { level: 1 })).toEqual([
      screen.getByRole('heading', { name: 'С возвращением' }),
    ]);
  });

  it('defines copy for every brand variant', () => {
    const missing = brandVariantKeys.flatMap((key) =>
      ['title', 'body']
        .map((field) => `auth.brandVariants.${key}.${field}`)
        .filter((path) => !i18n.exists(path)),
    );

    expect(missing).toEqual([]);
  });
});
