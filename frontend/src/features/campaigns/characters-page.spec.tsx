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

function renderPage() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={['/campaigns/c/characters']}>
        <Routes>
          <Route
            path="/campaigns/:campaignId/characters"
            element={<CharactersPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CharactersPage', () => {
  beforeEach(() => {
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
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  it('creates a player character without the removed NPC discriminator', async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Создать персонажа' }),
    );
    expect(
      await screen.findByRole('option', { name: 'PC template' }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Имя'), {
      target: { value: 'Alex' },
    });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/campaigns/c/characters', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Alex',
          data: {},
          templateId: 'pc-template',
        }),
      }),
    );
  });
});
