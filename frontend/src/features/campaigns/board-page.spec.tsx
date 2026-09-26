import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { BoardPage } from './board-page';

const request = vi.fn();
let role: 'OWNER' | 'PLAYER' | 'VIEWER' = 'VIEWER';
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({
    api: { request },
    profile: { userId: 'user' },
    signOut: vi.fn(),
  }),
}));

function renderBoard() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={['/campaigns/c/board']}>
        <Routes>
          <Route path="/campaigns/:campaignId/board" element={<BoardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BoardPage', () => {
  beforeAll(() => {
    // React Flow measures its container.
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  beforeEach(() => {
    role = 'VIEWER';
    request.mockReset();
    request.mockImplementation((path: string) => {
      if (path === '/campaigns/c')
        return Promise.resolve({
          campaignId: 'c',
          title: 'Campaign',
          currentUserRole: role,
          backgroundConfig: {
            selectionMode: 'FIXED',
            fixedBackgroundId: null,
            backgrounds: [],
          },
        });
      if (path === '/campaigns/c/investigation-board')
        return Promise.resolve({
          boardId: 'b',
          campaignId: 'c',
          cards: [],
          links: [],
        });
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  it('opens the board read-only for a viewer', async () => {
    renderBoard();
    expect(await screen.findByText(/Режим просмотра/)).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith('/campaigns/c/investigation-board');
    expect(
      screen.queryByRole('button', { name: 'Новая карточка' }),
    ).not.toBeInTheDocument();
    expect(document.querySelector('.board-canvas-readonly')).not.toBeNull();
    expect(
      document.querySelector('.campaign-background-layer'),
    ).not.toBeNull();
  });

  it('keeps editing controls for contributors', async () => {
    role = 'PLAYER';
    renderBoard();
    expect(
      await screen.findByRole('button', { name: 'Новая карточка' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Режим просмотра/)).not.toBeInTheDocument();
    expect(document.querySelector('.board-canvas-readonly')).toBeNull();
  });
});
