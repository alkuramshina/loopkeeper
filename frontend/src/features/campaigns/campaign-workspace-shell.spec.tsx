import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { Campaign } from '../../api/client';
import { CampaignWorkspaceShell } from './campaign-workspace-shell';

const auth = {
  profile: { userId: 'user-1', email: 'viewer@example.test', name: 'Viewer' },
  loading: false,
  api: {} as never,
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
    <MemoryRouter>
      <CampaignWorkspaceShell campaign={campaign}>
        <p>Page content</p>
      </CampaignWorkspaceShell>
    </MemoryRouter>,
  );
}

describe('CampaignWorkspaceShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the board but not owner settings to a viewer', () => {
    renderShell(baseCampaign);

    expect(
      screen.getAllByRole('navigation', { name: 'Кампании' }),
    ).toHaveLength(2);
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
    expect(
      screen.queryByRole('link', { name: 'Фоны' }),
    ).not.toBeInTheDocument();
  });
});
