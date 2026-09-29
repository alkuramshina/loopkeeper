import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { RouteErrorBoundary } from '../app/error-boundary';
import { ErrorPage } from './error-screen';

let profile: { userId: string; name: string } | null = null;
vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({ profile, signOut: vi.fn() }),
}));

function Broken(): never {
  throw new Error('render failed');
}

describe('error screens', () => {
  beforeEach(() => {
    profile = null;
  });

  it('keeps the app frame for a signed-in person', () => {
    profile = { userId: 'u', name: 'Ана' };
    render(
      <MemoryRouter>
        <ErrorPage kind="unavailable" message="Кампания недоступна." />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Кампания недоступна.');
    expect(
      screen.getByRole('heading', { name: 'Страница недоступна' }),
    ).toBeInTheDocument();
    expect(document.querySelector('.app-shell')).not.toBeNull();
    expect(document.querySelector('.auth-page')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'К моим кампаниям' }),
    ).toHaveAttribute('href', '/campaigns');
    expect(
      screen.queryByRole('button', { name: 'Повторить' }),
    ).not.toBeInTheDocument();
  });

  it('uses the sign-in frame for a guest', () => {
    render(
      <MemoryRouter>
        <ErrorPage
          kind="network"
          message="Нет связи с сервером."
          onRetry={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(document.querySelector('.auth-page')).not.toBeNull();
    expect(document.querySelector('.app-shell')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Повторить' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ко входу' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  it('shows a render failure in the app frame with a reload', () => {
    profile = { userId: 'u', name: 'Ана' };
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <Broken />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Произошла непредвиденная ошибка.',
    );
    expect(
      screen.getByRole('heading', { name: 'Что-то пошло не так' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Перезагрузить страницу' }),
    ).toBeInTheDocument();
    expect(document.querySelector('.app-shell')).not.toBeNull();
  });
});
