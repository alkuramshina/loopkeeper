import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { CharactersPage } from './characters-page';

const request = vi.fn();
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({
    api: { request },
    profile: { userId: 'player', email: 'player@example.test' },
    signOut: vi.fn(),
  }),
}));

function renderPage(path = '/campaigns/c/characters') {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/campaigns/:campaignId/characters"
            element={<CharactersPage />}
          />
          <Route
            path="/campaigns/:campaignId/characters/:characterId"
            element={<CharactersPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

let board: { cards: unknown[]; links: unknown[] };

describe('CharactersPage', () => {
  beforeEach(() => {
    board = { cards: [], links: [] };
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    request.mockReset();
    request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/campaigns/c')
        return Promise.resolve({
          campaignId: 'c',
          title: 'Campaign',
          system: 'TALES_FROM_THE_LOOP',
          currentUserRole: 'PLAYER',
        });
      if (path === '/campaigns/c/characters' && !init)
        return Promise.resolve([]);

      if (path === '/campaigns/c/characters' && init?.method === 'POST')
        return Promise.resolve({
          characterId: 'pc',
          ...JSON.parse(init.body as string),
        });
      if (path === '/campaigns/c/views') return Promise.resolve(undefined);
      if (path === '/campaigns/c/visit')
        return Promise.resolve({ lastVisitAt: null });
      if (path === '/campaigns/c/investigation-board')
        return Promise.resolve(board);
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  it('shows a player without a character the form right away', async () => {
    renderPage();
    const form = await screen.findByRole('form', { name: 'Новый персонаж' });
    // One template: nothing to choose.
    expect(screen.queryByLabelText('Шаблон')).toBeNull();
    fireEvent.change(screen.getByLabelText('Имя'), {
      target: { value: 'Alex' },
    });
    fireEvent.change(screen.getByLabelText('Возраст'), {
      target: { value: '12' },
    });
    fireEvent.change(screen.getByLabelText('Тип'), {
      target: { value: 'BOOKWORM' },
    });
    fireEvent.submit(form);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/campaigns/c/characters', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Alex',

          data: { age: 12, type: 'BOOKWORM' },
        }),
      }),
    );
  });

  it('saves system conditions and changed story fields from the detail', async () => {
    const character = {
      characterId: 'pc',
      campaignId: 'c',
      ownerId: 'player',

      name: 'Alex',
      description: '',
      isActive: true,
      data: {
        age: 12,
        type: 'BOOKWORM',
        drive: 'Find clues',
        upset: false,
        broken: false,
      },
    };
    request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/campaigns/c')
        return Promise.resolve({
          campaignId: 'c',
          title: 'Campaign',
          system: 'TALES_FROM_THE_LOOP',
          currentUserRole: 'PLAYER',
        });
      if (path === '/campaigns/c/characters')
        return Promise.resolve([character]);

      if (path === '/characters/pc' && init?.method === 'PATCH')
        return Promise.resolve({
          ...character,
          ...JSON.parse(init.body as string),
        });
      if (path === '/campaigns/c/visit')
        return Promise.resolve({ lastVisitAt: null });
      if (path === '/campaigns/c/investigation-board')
        return Promise.resolve(board);
      throw new Error(`Unexpected request: ${path}`);
    });
    renderPage('/campaigns/c/characters/pc');
    fireEvent.click(await screen.findByRole('button', { name: 'Сломлен(а)' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/characters/pc',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"broken":true'),
        }),
      ),
    );
    fireEvent.change(screen.getByLabelText('Стремление'), {
      target: { value: 'Find the Loop' },
    });
    await waitFor(
      () =>
        expect(request).toHaveBeenCalledWith(
          '/characters/pc',
          expect.objectContaining({
            body: expect.stringContaining('Find the Loop'),
          }),
        ),
      { timeout: 2000 },
    );
  });

  it('loads the system sheet without requesting a template API', async () => {
    renderPage();
    expect(await screen.findByLabelText('Возраст')).toBeInTheDocument();
    expect(screen.getByLabelText('Тип')).toBeInTheDocument();
    expect(
      request.mock.calls.some(([path]) => path.includes('/templates')),
    ).toBe(false);
  });

  it('does not offer creation for an unsupported system', async () => {
    const base = request.getMockImplementation()!;
    request.mockImplementation((path: string, init?: RequestInit) =>
      path === '/campaigns/c'
        ? Promise.resolve({
            campaignId: 'c',
            title: 'Campaign',
            system: 'UNKNOWN',
            currentUserRole: 'PLAYER',
          })
        : base(path, init),
    );
    renderPage();
    await screen.findByRole('heading', { name: 'Персонажи' });
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('hides "Add to board" once the character is on the board', async () => {
    const character = {
      characterId: 'pc',
      campaignId: 'c',
      ownerId: 'someone',
      owner: { userId: 'someone', name: 'Liza' },

      name: 'Maja',
      isActive: true,
      data: { age: 12, type: 'BOOKWORM' },
    };
    const base = request.getMockImplementation()!;
    request.mockImplementation((path: string, init?: RequestInit) =>
      path === '/campaigns/c/characters'
        ? Promise.resolve([character])
        : base(path, init),
    );
    board = {
      cards: [
        {
          cardId: 'card',
          cardKind: 'CHARACTER_REFERENCE',
          reference: { kind: 'CHARACTER', characterId: 'pc' },
        },
      ],
      links: [],
    };
    renderPage('/campaigns/c/characters/pc');
    expect(
      await screen.findByRole('heading', { name: 'Maja' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Книголюб · 12 лет · играет Liza').length,
    ).toBeGreaterThan(0);
    await waitFor(() =>
      expect(
        request.mock.calls.some(
          ([path]) => path === '/campaigns/c/investigation-board',
        ),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Добавить на доску' }),
      ).toBeNull(),
    );
  });
});
