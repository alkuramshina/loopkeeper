import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { Campaign } from '../../api/client';
import { CampaignWorkspaceShell } from './campaign-workspace-shell';

const auth = {
  profile: { userId: 'user-1', email: 'viewer@example.test', name: 'Viewer' },
  loading: false,
  api: { request: vi.fn().mockResolvedValue([]) },
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
};

vi.mock('../../auth/auth-context', () => ({
  useAuth: () => auth,
}));

const baseCampaign: Campaign = {
  campaignId: 'campaign-1',
  title: 'Test campaign',
  currentUserRole: 'VIEWER',
};

function renderShell(campaign: Campaign) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <CampaignWorkspaceShell campaign={campaign}>
          <p>Page content</p>
        </CampaignWorkspaceShell>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname + location.search}
    </output>
  );
}

describe('CampaignWorkspaceShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.profile.name = 'Viewer';
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
  });

  it('names the campaign in the tab title while inside it', () => {
    const { unmount } = renderShell(baseCampaign);
    expect(document.title).toBe('Test campaign — Loopkeeper');

    unmount();
    expect(document.title).toBe('Loopkeeper');
  });

  it('shows the board and the case but not notes or owner settings to a viewer', () => {
    renderShell(baseCampaign);

    expect(
      screen.getAllByRole('navigation', { name: 'Разделы кампании' }),
    ).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'Дело' })).toHaveLength(1);
    expect(screen.queryByRole('link', { name: 'Мои заметки' })).toBeNull();
    // The campaign name is plain text, not a second way back to the list.
    const identity = document.querySelector('.campaign-identity')!;
    expect(identity.closest('a, button')).toBeNull();
    expect(identity.querySelector('a, button')).toBeNull();
    const logo = screen.getByRole('link', { name: 'Все кампании' });
    expect(logo).toHaveAttribute('href', '/campaigns');
    expect(logo.querySelector('.logo')).not.toBeNull();
    expect(
      within(
        screen.getByRole('navigation', { name: 'Разделы кампании' }),
      ).queryByRole('link', { name: 'Все кампании' }),
    ).toBeNull();
    expect(
      screen.getAllByRole('link', { name: 'Доска расследования' }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole('link', { name: 'Участники' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Настройки кампании' }),
    ).not.toBeInTheDocument();
  });

  it('exposes owner-only workspace settings to the owner', () => {
    renderShell({ ...baseCampaign, currentUserRole: 'OWNER' });

    expect(
      screen.getAllByRole('link', { name: 'Доска расследования' }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('link', { name: 'Настройки кампании' }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Материалы' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Фоны' })).toHaveAttribute(
      'href',
      '/campaigns/campaign-1/settings/backgrounds',
    );
  });

  it.each(['Мастер', 'Игрок', 'Наблюдатель'])(
    'does not use the generic %s role as the profile link text',
    (role) => {
      auth.profile.name = role;
      renderShell({ ...baseCampaign, currentUserRole: 'PLAYER' });

      expect(screen.getByRole('link', { name: 'Профиль' })).toHaveAttribute(
        'href',
        '/settings/account',
      );
      expect(screen.queryByRole('link', { name: role })).toBeNull();
    },
  );

  it('gives a player the case and their own notes', () => {
    renderShell({ ...baseCampaign, currentUserRole: 'PLAYER' });

    for (const name of ['Дело', 'Мои заметки'])
      expect(screen.getAllByRole('link', { name })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'Дело' })[0]).toHaveAttribute(
      'href',
      '/campaigns/campaign-1/case',
    );
    expect(
      screen.getAllByRole('link', { name: 'Мои заметки' })[0],
    ).toHaveAttribute('href', '/campaigns/campaign-1/notes');
    expect(screen.queryByRole('link', { name: 'Материалы' })).toBeNull();
  });

  it('marks the case only when this member has new visible materials', () => {
    const { container, rerender } = renderShell({
      ...baseCampaign,
      currentUserRole: 'PLAYER',
      newVisibleMaterialCount: 2,
    });
    // The case link and the compact menu both show the marker.
    expect(container.querySelectorAll('.campaign-nav-new')).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: 'новое' })).toHaveLength(1);
    expect(
      screen
        .getByRole('button', { name: 'Меню' })
        .querySelector('.campaign-nav-new'),
    ).not.toBeNull();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <CampaignWorkspaceShell
            campaign={{
              ...baseCampaign,
              currentUserRole: 'OWNER',
              newVisibleMaterialCount: 2,
            }}
          >
            <p>Page content</p>
          </CampaignWorkspaceShell>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(container.querySelectorAll('.campaign-nav-new')).toHaveLength(0);
  });

  it('searches only visible materials with keyboard navigation', async () => {
    vi.mocked(auth.api.request).mockImplementation((path: string) => {
      if (path.endsWith('/elements'))
        return Promise.resolve([
          {
            elementId: 'secret',
            title: 'Hidden clue',
            content: 'Cipher',
            type: 'NOTE',
            access: 'MASTER_ONLY',
            createdById: 'owner',
          },
          {
            elementId: 'open',
            title: 'Open clue',
            content: 'Map',
            type: 'NOTE',
            access: 'SHARED',
            createdById: 'owner',
          },
        ]) as never;
      return Promise.resolve([]) as never;
    });
    renderShell({ ...baseCampaign, currentUserRole: 'OWNER' });
    // A Russian layout reports "л" for the K key.
    fireEvent.keyDown(window, { key: 'л', code: 'KeyK', ctrlKey: true });
    const input = screen.getByRole('searchbox', {
      name: 'Название или текст материала',
    });
    await screen.findByRole('button', { name: /Hidden clue/ });
    fireEvent.change(input, { target: { value: 'clue' } });
    fireEvent.click(screen.getByRole('button', { name: 'Скрыто' }));
    expect(
      screen.getByRole('button', { name: /Hidden clue/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open clue/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Всё' }));
    expect(
      vi
        .mocked(auth.api.request)
        .mock.calls.some(([path]) =>
          String(path).endsWith('/investigation-board'),
        ),
    ).toBe(false);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/campaigns/campaign-1/elements/open',
      ),
    );
  });

  it('limits a viewer to returned resources and hides the write action', async () => {
    vi.mocked(auth.api.request).mockImplementation((path: string) => {
      if (path.endsWith('/elements'))
        return Promise.resolve([
          {
            elementId: 'open',
            title: 'Open clue',
            content: '',
            type: 'NOTE',
            access: 'SHARED',
            createdById: 'owner',
          },
        ]) as never;
      return Promise.resolve([]) as never;
    });
    renderShell(baseCampaign);
    fireEvent.click(document.querySelector('.campaign-search-trigger')!);
    await screen.findByRole('button', { name: /Open clue/ });
    expect(
      screen.queryByRole('button', { name: 'Быстрая заметка' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Скрыто' })).toBeNull();
  });

  it('opens search with a slash, but not while typing', () => {
    vi.mocked(auth.api.request).mockResolvedValue([] as never);
    renderShell(baseCampaign);
    const field = document.createElement('input');
    document.body.append(field);
    fireEvent.keyDown(field, { key: '/' });
    expect(screen.queryByRole('dialog')).toBeNull();
    field.remove();
    fireEvent.keyDown(window, { key: '/' });
    expect(
      screen.getByRole('dialog', { name: 'Поиск материалов' }),
    ).toBeInTheDocument();
  });

  it('slides the sidebar out from a menu on a tablet and closes it again', () => {
    // Only the tablet range matches.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('min-width: 600px'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    try {
      const { container } = renderShell({
        ...baseCampaign,
        currentUserRole: 'OWNER',
      });
      const menu = screen.getByRole('button', { name: 'Меню' });
      const sidebar = container.querySelector('#campaign-sidebar');
      expect(menu).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(menu);
      expect(menu).toHaveAttribute('aria-expanded', 'true');
      expect(sidebar).toHaveClass('campaign-workspace-shell-sidebar-open');
      expect(sidebar).toContainElement(document.activeElement as HTMLElement);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(menu).toHaveAttribute('aria-expanded', 'false');
      expect(menu).toHaveFocus();

      // Following a link closes the menu.
      fireEvent.click(menu);
      fireEvent.click(screen.getAllByRole('link', { name: 'Участники' })[0]);
      expect(menu).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/campaigns/campaign-1/members',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
