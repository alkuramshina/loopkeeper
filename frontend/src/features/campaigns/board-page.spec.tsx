import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { BoardPage } from './board-page';

const request = vi.fn();
const requestBlob = vi.fn();
let role: 'OWNER' | 'PLAYER' | 'VIEWER' = 'VIEWER';
let cards: unknown[] = [];
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({
    api: { request, requestBlob },
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
    cards = [];
    requestBlob.mockReset();
    requestBlob.mockResolvedValue(new Blob(['image'], { type: 'image/webp' }));
    URL.createObjectURL = vi.fn(() => 'blob:cover');
    URL.revokeObjectURL = vi.fn();
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
          cards,
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

  it('shows the element cover on its reference card through protected media', async () => {
    cards = [
      {
        cardId: 'card',
        cardKind: 'ELEMENT_REFERENCE',
        title: 'Power plant',
        content: 'Humming at night',
        tags: [],
        node: { x: 0, y: 0, width: 240, height: 200 },
        reference: {
          kind: 'ELEMENT',
          elementId: 'element',
          coverUrl: '/media/cover',
        },
      },
    ];
    renderBoard();
    expect(await screen.findByText('Power plant')).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(
        document.querySelector('.flow-card-cover')?.getAttribute('src'),
      ).toBe('blob:cover'),
    );
    expect(requestBlob).toHaveBeenCalledWith('/media/cover');
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
