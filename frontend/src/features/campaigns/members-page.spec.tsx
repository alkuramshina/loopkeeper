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
import { ApiError } from '../../api/client';
import { MembersPage } from './members-page';

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
};
const acceptedInvitation = {
  ...activeInvitation,
  invitationId: 'i2',
  role: 'PLAYER',
  acceptedAt: future,
};

function renderPage() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={['/campaigns/c/members']}>
        <Routes>
          <Route
            path="/campaigns/:campaignId/members"
            element={<MembersPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MembersPage', () => {
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

  it('lists members and invitations with their status', async () => {
    renderPage();

    expect(await screen.findByText('Kim')).toBeInTheDocument();
    expect(screen.getByText('kim@example.test')).toBeInTheDocument();
    expect(screen.getByLabelText('Роль для Kim')).toHaveValue('PLAYER');
    // The master is listed as «Мастер» without management controls.
    const masterRow = screen.getByText('Mira').closest('article')!;
    expect(within(masterRow).getByText('Мастер')).toBeInTheDocument();
    expect(within(masterRow).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(masterRow).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Удалить' })).toHaveLength(1);
    expect(screen.getByText('Активно')).toBeInTheDocument();
    expect(screen.getByText('Принято')).toBeInTheDocument();
    // Only an active invitation can be revoked.
    expect(screen.getAllByRole('button', { name: 'Отозвать' })).toHaveLength(1);
  });

  it('creates an invitation and shows the one-time link', async () => {
    renderPage();
    await screen.findByText('Kim');

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

  it('changes a role and removes a member only after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    renderPage();
    await screen.findByText('Kim');

    fireEvent.change(screen.getByLabelText('Роль для Kim'), {
      target: { value: 'VIEWER' },
    });
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/campaigns/c/members/u1', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'VIEWER' }),
      }),
    );

    const removeButton = screen.getByRole('button', { name: 'Удалить' });
    confirm.mockReturnValueOnce(false);
    fireEvent.click(removeButton);
    expect(request).not.toHaveBeenCalledWith('/campaigns/c/members/u1', {
      method: 'DELETE',
    });

    confirm.mockReturnValueOnce(true);
    fireEvent.click(removeButton);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/campaigns/c/members/u1', {
        method: 'DELETE',
      }),
    );
  });

  it('revokes an active invitation after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await screen.findByText('Kim');

    fireEvent.click(screen.getByRole('button', { name: 'Отозвать' }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/campaigns/c/invitations/i1', {
        method: 'DELETE',
      }),
    );
  });

  it('shows a failed role change by its error code', async () => {
    renderPage();
    await screen.findByText('Kim');
    request.mockImplementationOnce(() =>
      Promise.reject(
        new ApiError(404, 'resource.not_found', 'Not found', undefined),
      ),
    );

    fireEvent.change(screen.getByLabelText('Роль для Kim'), {
      target: { value: 'VIEWER' },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ресурс недоступен.',
    );
  });

  it.each(['PLAYER', 'VIEWER'] as const)(
    'shows the neutral unavailable state to a %s without loading members',
    async (currentRole) => {
      role = currentRole;
      renderPage();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Ресурс недоступен.',
      );
      expect(request).not.toHaveBeenCalledWith('/campaigns/c/members');
      expect(request).not.toHaveBeenCalledWith('/campaigns/c/invitations');
    },
  );
});
