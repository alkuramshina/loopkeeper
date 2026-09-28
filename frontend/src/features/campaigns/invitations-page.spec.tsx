import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { InvitationsPage } from './invitations-page';

const request = vi.fn();
let role: 'OWNER' | 'PLAYER' | 'VIEWER' = 'OWNER';
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({
    api: { request, requestBlob: vi.fn() },
    profile: { userId: 'master', name: 'Master' },
    signOut: vi.fn(),
  }),
}));

const future = new Date(Date.now() + 86_400_000).toISOString();
const master = {
  memberId: 'm0',
  campaignId: 'c',
  campaignRole: 'OWNER',
  user: { userId: 'master', email: 'mira@example.test', name: 'Mira' },
};
const member = {
  memberId: 'm1',
  campaignId: 'c',
  campaignRole: 'PLAYER',
  user: { userId: 'u1', email: 'kim@example.test', name: 'Kim' },
};
const activeInvitation = {
  invitationId: 'i1',
  campaignId: 'c',
  role: 'VIEWER',
  expiresAt: future,
  acceptedAt: null,
  revokedAt: null,
  createdAt: '',
  createdById: 'master',
  token: 'i1.secret',
};
const acceptedInvitation = {
  ...activeInvitation,
  invitationId: 'i2',
  role: 'PLAYER',
  token: null,
  acceptedAt: future,
  acceptedBy: member.user,
};

function renderPage() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={['/campaigns/c/invitations']}>
        <Routes>
          <Route
            path="/campaigns/:campaignId/invitations"
            element={<InvitationsPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('InvitationsPage', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    role = 'OWNER';
    request.mockReset();
    request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/campaigns/c')
        return Promise.resolve({
          campaignId: 'c',
          title: 'Campaign',
          currentUserRole: role,
        });
      if (path === '/campaigns/c/members' && !init)
        return Promise.resolve([master, member]);
      if (path === '/campaigns/c/invitations' && !init)
        return Promise.resolve([activeInvitation, acceptedInvitation]);
      if (path === '/campaigns/c/invitations' && init?.method === 'POST')
        return Promise.resolve({
          ...activeInvitation,
          invitationId: 'i3',
          token: 'i3.secret',
        });
      if (init?.method === 'PATCH' || init?.method === 'DELETE')
        return Promise.resolve(undefined);
      if (path === '/campaigns/c/visit')
        return Promise.resolve({ newSinceAt: null });
      throw new Error(`Unexpected request: ${path}`);
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('lists invitations with their status and who accepted them', async () => {
    renderPage();

    expect(await screen.findByText('Активно')).toBeInTheDocument();
    expect(screen.getByText('Принято')).toBeInTheDocument();
    const acceptedRow = screen.getByText('Kim').closest('article')!;
    expect(within(acceptedRow).getByText('Кто принял')).toBeInTheDocument();
    // Only an active invitation can be revoked or copied.
    expect(screen.getAllByRole('button', { name: 'Отозвать' })).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: 'Скопировать ссылку' }),
    ).toHaveLength(1);
    expect(request).not.toHaveBeenCalledWith('/campaigns/c/members');
  });

  it('creates an invitation and shows the one-time link', async () => {
    renderPage();
    await screen.findAllByText('Активно');

    fireEvent.click(
      screen.getByRole('button', { name: 'Создать приглашение' }),
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Роль'), {
      target: { value: 'VIEWER' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Создать приглашение' }),
    );

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(
      `${window.location.origin}/invitations/i3.secret`,
    );
    expect(request).toHaveBeenCalledWith('/campaigns/c/invitations', {
      method: 'POST',
      body: JSON.stringify({ role: 'VIEWER' }),
    });
  });

  it('copies the link of an active invitation again later', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderPage();
    await screen.findAllByText('Активно');

    const copy = screen.getByRole('button', { name: 'Скопировать ссылку' });
    fireEvent.click(copy);

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/invitations/i1.secret`,
      ),
    );
    expect(
      await screen.findByRole('button', { name: 'Скопировано' }),
    ).toBeInTheDocument();
  });

  it('revokes an active invitation after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await screen.findAllByText('Активно');

    fireEvent.click(screen.getByRole('button', { name: 'Отозвать' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/campaigns/c/invitations/i1', {
        method: 'DELETE',
      }),
    );
  });

  it.each(['PLAYER', 'VIEWER'] as const)(
    'shows the neutral unavailable state to a %s without loading invitations',
    async (currentRole) => {
      role = currentRole;
      renderPage();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Ресурс недоступен.',
      );
      expect(request).not.toHaveBeenCalledWith('/campaigns/c/invitations');
    },
  );
});
