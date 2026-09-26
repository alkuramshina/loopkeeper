import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { ElementsPage } from './elements-page';

const request = vi.fn();
const requestBlob = vi.fn();
let role: 'OWNER' | 'PLAYER' | 'VIEWER' = 'OWNER';
let userId = 'master';
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({
    api: { request, requestBlob },
    profile: { userId },
    signOut: vi.fn(),
  }),
}));
const master = { userId: 'master', name: 'Master' };
const player = { userId: 'player', name: 'Player' };
const privateElement = {
  elementId: 'private',
  campaignId: 'c',
  type: 'NOTE',
  access: 'MASTER_ONLY',
  title: 'Secret',
  content: 'Hidden',
  typeData: {},
  createdAt: '',
  updatedAt: '',
  createdById: master.userId,
  createdBy: master,
};
const sharedElement = {
  ...privateElement,
  elementId: 'shared',
  access: 'SHARED',
  title: 'Shared',
  content: '**Visible**',
};
const playerNote = {
  ...privateElement,
  elementId: 'player-note',
  title: 'My hunch',
  content: 'The tower hums',
  createdById: player.userId,
  createdBy: player,
};

const uploadedLocation = {
  ...privateElement,
  elementId: 'uploaded-location',
  type: 'LOCATION',
  title: 'Plant',
  content: '',
  imageUrl: '/media/map-asset',
  coverUrl: '/media/cover-asset',
};

function listFor(currentRole: typeof role) {
  if (currentRole === 'OWNER')
    return [privateElement, sharedElement, playerNote];
  if (currentRole === 'PLAYER') return [sharedElement, playerNote];
  return [sharedElement];
}

function renderPage(path = '/campaigns/c/elements') {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/campaigns/:campaignId/elements"
            element={<ElementsPage />}
          />
          <Route
            path="/campaigns/:campaignId/elements/:elementId"
            element={<ElementsPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ElementsPage', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    role = 'OWNER';
    userId = 'master';
    requestBlob.mockReset();
    requestBlob.mockResolvedValue(new Blob(['image'], { type: 'image/webp' }));
    URL.createObjectURL = vi.fn(() => 'blob:image');
    URL.revokeObjectURL = vi.fn();
    request.mockReset();
    request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/campaigns/c')
        return Promise.resolve({
          campaignId: 'c',
          title: 'Campaign',
          currentUserRole: role,
        });
      if (path === '/campaigns/c/elements' && !init)
        return Promise.resolve(listFor(role));
      if (path === '/elements/shared') return Promise.resolve(sharedElement);
      if (path === '/elements/private') return Promise.resolve(privateElement);
      if (path === '/elements/player-note') return Promise.resolve(playerNote);
      if (path === '/elements/location')
        return Promise.resolve({
          ...sharedElement,
          elementId: 'location',
          type: 'LOCATION',
          title: 'Map',
          imageUrl: 'https://example.test/map.png',
          content:
            '[safe](https://example.test) [unsafe](javascript:alert(1)) <script>alert(1)</script>',
        });
      if (path === '/elements/uploaded-location' && !init)
        return Promise.resolve(uploadedLocation);
      if (path === '/elements/uploaded-location' && init?.method === 'PATCH')
        return Promise.resolve(uploadedLocation);
      if (path === '/elements/private/access' && init?.method === 'PATCH')
        return Promise.resolve({ ...privateElement, access: 'SHARED' });
      if (path === '/campaigns/c/elements' && init?.method === 'POST')
        return Promise.resolve({
          ...privateElement,
          elementId: 'created',
          ...JSON.parse(init.body as string),
        });
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  it('shows shared elements to viewers read-only, with the board in navigation', async () => {
    role = 'VIEWER';
    userId = 'viewer';
    renderPage('/campaigns/c/elements/shared');
    expect(
      await screen.findByRole('heading', { name: 'Shared' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
    expect(screen.getByText('Автор: Master')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Новый элемент' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Новая заметка' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Добавить на доску' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Доступ')).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'Доска расследования' }).length,
    ).toBeGreaterThan(0);
  });

  it('changes access of an own element via the access endpoint', async () => {
    renderPage('/campaigns/c/elements/private');
    const control = await screen.findByLabelText('Доступ');
    expect(
      within(control)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Только мастер', 'Всем']);
    fireEvent.change(control, { target: { value: 'SHARED' } });
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/elements/private/access', {
        method: 'PATCH',
        body: JSON.stringify({ access: 'SHARED' }),
      }),
    );
  });

  it('shows a player note to the master as "to the master" without author controls', async () => {
    renderPage('/campaigns/c/elements/player-note');
    const heading = await screen.findByRole('heading', { name: 'My hunch' });
    expect(heading.parentElement).toHaveTextContent('Мастеру');
    expect(screen.getByText('Автор: Player')).toBeInTheDocument();
    expect(screen.queryByLabelText('Доступ')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Редактировать' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Удалить' }),
    ).not.toBeInTheDocument();
  });

  it('lets a player manage their own note and only read master materials', async () => {
    role = 'PLAYER';
    userId = 'player';
    renderPage('/campaigns/c/elements/player-note');
    const control = await screen.findByLabelText('Доступ');
    expect(
      within(control)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Лично', 'Мастеру', 'Всем']);
    expect(screen.queryByText('Автор: Player')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /Shared/ }));
    expect(
      await screen.findByRole('heading', { name: 'Shared' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Автор: Master')).toBeInTheDocument();
    expect(screen.queryByLabelText('Доступ')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Удалить' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Добавить на доску' }),
    ).toBeInTheDocument();
  });

  it('creates a private note for a player with the type fixed', async () => {
    role = 'PLAYER';
    userId = 'player';
    renderPage('/campaigns/c/elements?type=NPC');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Новая заметка' }),
    );
    expect(screen.getByLabelText('Тип')).toBeDisabled();
    expect(screen.getByLabelText('Тип')).toHaveValue('NOTE');
    expect(screen.getByLabelText('Доступ')).toHaveValue('PRIVATE');
    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: 'Hunch' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/campaigns/c/elements',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            type: 'NOTE',
            title: 'Hunch',
            content: '',
            access: 'PRIVATE',
          }),
        }),
      ),
    );
  });

  it('renders an inline location map without activating unsafe Markdown', async () => {
    renderPage('/campaigns/c/elements/location');
    expect(
      await screen.findByRole('heading', { name: 'Map' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Открыть карту' }),
    ).toContainElement(screen.getByRole('img', { name: 'Map' }));
    expect(screen.getByRole('link', { name: 'safe' })).toHaveAttribute(
      'href',
      'https://example.test',
    );
    expect(
      screen.queryByRole('link', { name: 'unsafe' }),
    ).not.toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });

  it('shows uploaded cover and map through protected media with author upload controls', async () => {
    renderPage('/campaigns/c/elements/uploaded-location');
    expect(
      await screen.findByRole('heading', { name: 'Plant' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(requestBlob).toHaveBeenCalledWith('/media/cover-asset');
      expect(requestBlob).toHaveBeenCalledWith('/media/map-asset');
    });
    expect(
      within(screen.getByRole('region', { name: 'Открыть карту' })).getByRole(
        'img',
        { name: 'Plant' },
      ),
    ).toHaveAttribute('src', 'blob:image');
    expect(screen.getByLabelText('Обложка')).toHaveAttribute('type', 'file');
    expect(screen.getByLabelText('Файл карты')).toHaveAttribute('type', 'file');

    // Saving the form keeps the uploaded map: the map link is not sent.
    fireEvent.click(screen.getByRole('button', { name: 'Редактировать' }));
    expect(screen.getByLabelText('HTTPS-адрес карты')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/elements/uploaded-location', {
        method: 'PATCH',
        body: JSON.stringify({ type: 'LOCATION', title: 'Plant', content: '' }),
      }),
    );
  });

  it('hides element media controls from readers who are not the author', async () => {
    role = 'PLAYER';
    userId = 'player';
    renderPage('/campaigns/c/elements/shared');
    expect(
      await screen.findByRole('heading', { name: 'Shared' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Обложка')).not.toBeInTheDocument();
  });

  it('creates an NPC as master-only with required typeData', async () => {
    renderPage('/campaigns/c/elements?type=NPC');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Новый элемент' }),
    );
    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: 'Keeper' },
    });
    fireEvent.change(screen.getByLabelText('Роль'), {
      target: { value: 'Witness' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/campaigns/c/elements',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            type: 'NPC',
            title: 'Keeper',
            content: '',
            access: 'MASTER_ONLY',
            typeData: { role: 'Witness' },
          }),
        }),
      ),
    );
  });
});
