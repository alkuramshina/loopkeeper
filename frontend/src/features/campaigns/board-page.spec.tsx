import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { ApiError } from '../../api/client';
import { ToastProvider } from '../../components/ui/toast';
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
      <ToastProvider>
        <MemoryRouter initialEntries={['/campaigns/c/board']}>
          <Routes>
            <Route
              path="/campaigns/:campaignId/board"
              element={<BoardPage />}
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
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
        });
      if (path === '/campaigns/c/investigation-board')
        return Promise.resolve({
          boardId: 'b',
          campaignId: 'c',
          cards,
          links: [],
        });
      if (path === '/campaigns/c/visit')
        return Promise.resolve({ newSinceAt: null });
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
    await waitFor(() =>
      expect(document.querySelector('.board-canvas-readonly')).not.toBeNull(),
    );
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

  it('keeps the last snapshot when a manual refresh fails and recovers on the next one', async () => {
    role = 'PLAYER';
    cards = [
      {
        cardId: 'card',
        cardKind: 'FREE',
        title: 'Broken fence',
        content: '',
        tags: [],
        node: { x: 0, y: 0, width: 240, height: 160 },
      },
    ];
    renderBoard();
    expect(await screen.findByText('Broken fence')).toBeInTheDocument();

    const boardResponse = request.getMockImplementation()!;
    request.mockImplementation((path: string) =>
      path === '/campaigns/c/investigation-board'
        ? Promise.reject(new TypeError('Failed to fetch'))
        : boardResponse(path),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Нет связи с сервером.',
    );
    expect(screen.getByText('Broken fence')).toBeInTheDocument();

    request.mockImplementation(boardResponse);
    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Broken fence')).toBeInTheDocument();
  });

  it('tells a network failure apart from an unavailable board', async () => {
    request.mockImplementation((path: string) =>
      path === '/campaigns/c'
        ? Promise.reject(new TypeError('Failed to fetch'))
        : Promise.reject(new Error(`Unexpected request: ${path}`)),
    );
    renderBoard();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Нет связи с сервером.',
    );
    expect(
      screen.getByRole('button', { name: 'Повторить' }),
    ).toBeInTheDocument();
  });

  it('keeps an unavailable board tenant-neutral without a retry', async () => {
    request.mockImplementation(() =>
      Promise.reject(
        new ApiError(404, 'campaign.not_found', 'Not found', undefined),
      ),
    );
    renderBoard();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Этот ресурс недоступен.',
    );
    expect(
      screen.queryByRole('button', { name: 'Повторить' }),
    ).not.toBeInTheDocument();
  });

  it('keeps editing controls for contributors', async () => {
    role = 'PLAYER';
    renderBoard();
    expect(
      (await screen.findAllByRole('button', { name: 'Новая карточка' }))[0],
    ).toBeInTheDocument();
    expect(screen.queryByText(/Режим просмотра/)).not.toBeInTheDocument();
    expect(document.querySelector('.board-canvas-readonly')).toBeNull();
  });

  it('outlines a coloured free card without naming its type', async () => {
    cards = [
      {
        cardId: 'card',
        cardKind: 'FREE',
        title: 'Broken fence',
        tags: [],
        color: 'rose',
        node: { x: 0, y: 0, width: 240, height: 160 },
      },
    ];
    renderBoard();
    expect(await screen.findByText('Broken fence')).toBeInTheDocument();
    expect(
      document.querySelector('.flow-card.board-color-rose'),
    ).not.toBeNull();
    expect(screen.queryByText('Своя мысль')).not.toBeInTheDocument();
  });

  it('adds a shared material from the new card panel', async () => {
    role = 'PLAYER';
    cards = [
      {
        cardId: 'placed',
        cardKind: 'ELEMENT_REFERENCE',
        title: 'Power plant',
        tags: [],
        node: { x: 0, y: 0, width: 240, height: 160 },
        reference: { kind: 'ELEMENT', elementId: 'on-board', type: 'LOCATION' },
      },
    ];
    const boardResponse = request.getMockImplementation()!;
    request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/campaigns/c/elements')
        return Promise.resolve([
          {
            elementId: 'on-board',
            type: 'LOCATION',
            access: 'SHARED',
            title: 'Power plant',
          },
          {
            elementId: 'hidden',
            type: 'NPC',
            access: 'PRIVATE',
            title: 'My guess',
          },
          {
            elementId: 'radio',
            type: 'NOTE',
            access: 'SHARED',
            title: 'Radio signal',
          },
        ]);
      if (path === '/campaigns/c/cards' && init?.method === 'POST')
        return Promise.resolve({ cardId: 'new' });
      if (path === '/investigation-board/nodes/new') return Promise.resolve({});
      return boardResponse(path);
    });
    renderBoard();
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Новая карточка' }))[0],
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Материал кампании' }));

    const option = await screen.findByRole('button', { name: /Radio signal/ });
    expect(
      screen.queryByRole('button', { name: /My guess/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Power plant/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(option);

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/campaigns/c/cards', {
        method: 'POST',
        body: JSON.stringify({
          cardKind: 'ELEMENT_REFERENCE',
          elementId: 'radio',
        }),
      }),
    );
  });
});
