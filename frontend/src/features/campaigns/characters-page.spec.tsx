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
          system: 'system',
          currentUserRole: 'PLAYER',
        });
      if (path === '/campaigns/c/characters' && !init)
        return Promise.resolve([]);
      if (path === '/game-systems/system/templates')
        return Promise.resolve([
          {
            templateId: 'pc-template',
            name: 'PC template',
            schema: { fields: [] },
          },
        ]);
      if (path === '/campaigns/c/characters' && init?.method === 'POST')
        return Promise.resolve({
          characterId: 'pc',
          ...JSON.parse(init.body as string),
        });
      if (path === '/campaigns/c/visit')
        return Promise.resolve({ newSinceAt: null });
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
    fireEvent.submit(form);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/campaigns/c/characters', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Alex',
          templateId: 'pc-template',
          data: {},
        }),
      }),
    );
  });

  it('saves template conditions and changed story fields from the detail', async () => {
    const character = {
      characterId: 'pc',
      campaignId: 'c',
      ownerId: 'player',
      templateId: 'pc-template',
      name: 'Alex',
      description: '',
      isActive: true,
      data: { drive: 'Find clues', upset: false, broken: false },
    };
    request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/campaigns/c')
        return Promise.resolve({
          campaignId: 'c',
          title: 'Campaign',
          system: 'system',
          currentUserRole: 'PLAYER',
        });
      if (path === '/campaigns/c/characters')
        return Promise.resolve([character]);
      if (path === '/game-systems/system/templates')
        return Promise.resolve([
          {
            templateId: 'pc-template',
            name: 'Kid',
            schema: {
              fields: [
                {
                  key: 'drive',
                  label: 'Drive',
                  section: 'story',
                  type: 'string',
                },
                {
                  key: 'upset',
                  label: 'Upset',
                  section: 'conditions',
                  type: 'boolean',
                },
                {
                  key: 'broken',
                  label: 'Broken',
                  section: 'conditions',
                  type: 'boolean',
                },
              ],
            },
          },
        ]);
      if (path === '/characters/pc' && init?.method === 'PATCH')
        return Promise.resolve({
          ...character,
          ...JSON.parse(init.body as string),
        });
      if (path === '/campaigns/c/visit')
        return Promise.resolve({ newSinceAt: null });
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

  it('offers the template choice only when there is more than one', async () => {
    const base = request.getMockImplementation()!;
    request.mockImplementation((path: string, init?: RequestInit) =>
      path === '/game-systems/system/templates'
        ? Promise.resolve([
            { templateId: 'a', name: 'Kid', schema: { fields: [] } },
            { templateId: 'b', name: 'Teen', schema: { fields: [] } },
          ])
        : base(path, init),
    );
    renderPage();
    expect(await screen.findByLabelText('Шаблон')).toBeInTheDocument();
  });

  it('hides "Add to board" once the character is on the board', async () => {
    const character = {
      characterId: 'pc',
      campaignId: 'c',
      ownerId: 'someone',
      owner: { userId: 'someone', name: 'Liza' },
      templateId: 'pc-template',
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
