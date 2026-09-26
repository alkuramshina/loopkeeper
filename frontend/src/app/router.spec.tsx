import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { AppRouter } from './router';

const request = vi.fn();
const auth = {
  profile: null as null | { userId: string; email: string },
  loading: false,
  api: { request },
};
vi.mock('../auth/auth-context', () => ({
  useAuth: () => auth,
}));

function renderAt(entry: string) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <AppRouter />
    </MemoryRouter>,
  );
}

describe('AppRouter', () => {
  beforeEach(() => {
    request.mockReset();
    // Keep lazy pages in their loading state; routing is what is under test.
    request.mockReturnValue(new Promise(() => undefined));
    auth.profile = null;
  });

  it('sends a signed-out visitor from an invitation to sign-in with the token', async () => {
    renderAt('/invitations/token-1');

    expect(
      await screen.findByRole('heading', { name: 'Войдите в Loopkeeper' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Создать аккаунт' })).toHaveAttribute(
      'href',
      '/sign-up?invitation=token-1',
    );
  });

  it('continues a signed-in user from sign-in to the pending invitation', async () => {
    auth.profile = { userId: 'user-1', email: 'user@example.test' };
    renderAt('/sign-in?invitation=token-1');

    expect(
      await screen.findByText('Проверяем приглашение и подключаем вас к кампании…'),
    ).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith('/invitations/token-1/accept', {
      method: 'POST',
    });
  });

  it('redirects a signed-out visitor away from protected pages', async () => {
    renderAt('/campaigns');

    expect(
      await screen.findByRole('heading', { name: 'Войдите в Loopkeeper' }),
    ).toBeInTheDocument();
  });
});
