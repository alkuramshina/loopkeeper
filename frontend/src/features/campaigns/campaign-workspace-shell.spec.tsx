import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { Campaign } from '../../api/client';
import { CampaignWorkspaceShell } from './campaign-workspace-shell';

const auth = {
  profile: { userId: 'user-1', email: 'viewer@example.test', name: 'Viewer' },
  loading: false,
  api: { request: vi.fn().mockResolvedValue([]) } as never,
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
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CampaignWorkspaceShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the board and the case but not notes or owner settings to a viewer', () => {
    renderShell(baseCampaign);

    expect(
      screen.getAllByRole('navigation', { name: 'Разделы кампании' }),
    ).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Дело' })).toHaveLength(2);
    expect(screen.queryByRole('link', { name: 'Мои заметки' })).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Выбрать другую кампанию' }),
    ).toHaveAttribute('href', '/campaigns');
    expect(
      screen.getAllByRole('link', { name: 'Доска расследования' }),
    ).toHaveLength(2);
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
    expect(screen.getAllByRole('link', { name: 'Материалы' })).toHaveLength(2);
    expect(
      screen.queryByRole('link', { name: 'Фоны' }),
    ).not.toBeInTheDocument();
  });

  it('gives a player the case and their own notes', () => {
    renderShell({ ...baseCampaign, currentUserRole: 'PLAYER' });

    for (const name of ['Дело', 'Мои заметки'])
      expect(screen.getAllByRole('link', { name })).toHaveLength(2);
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
    expect(container.querySelectorAll('.campaign-nav-new')).toHaveLength(2);

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
});
