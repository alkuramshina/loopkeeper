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
import { ApiError } from '../../api/client';
import { ToastProvider } from '../../components/ui/toast';
import { ElementsPage } from './elements-page';

const request = vi.fn();
const requestBlob = vi.fn();
let role: 'OWNER' | 'PLAYER' | 'VIEWER' = 'OWNER';
let userId = 'master';
let created: unknown;
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
  imageUrl: null,
  typeData: {},
  createdAt: '2026-09-27T10:00:00.000Z',
  updatedAt: '2026-09-27T10:00:00.000Z',
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
const members = [
  { memberId: 'm1', campaignRole: 'OWNER', user: { ...master, email: 'm@x' } },
  { memberId: 'm2', campaignRole: 'PLAYER', user: { ...player, email: 'p@x' } },
  {
    memberId: 'm3',
    campaignRole: 'VIEWER',
    user: { userId: 'viewer', name: 'Viewer', email: 'v@x' },
  },
];
// The shared element sits on the board once, with two links to its card.
const board = {
  boardId: 'b',
  cards: [
    { cardId: 'k1', reference: { kind: 'ELEMENT', elementId: 'shared' } },
    { cardId: 'k2' },
    { cardId: 'k3' },
  ],
  links: [
    { linkId: 'l1', fromCardId: 'k1', toCardId: 'k2' },
    { linkId: 'l2', fromCardId: 'k3', toCardId: 'k1' },
    { linkId: 'l3', fromCardId: 'k2', toCardId: 'k3' },
  ],
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
      <ToastProvider>
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
            <Route path="/campaigns/:campaignId/case" element={<p>Case</p>} />
            <Route
              path="/campaigns/:campaignId/case/:elementId"
              element={<p>Case reader</p>}
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const detail = () => screen.getByRole('article');
const list = () =>
  screen.getByRole('navigation', { name: 'Список материалов' });
const calls = (path: string, method: string) =>
  request.mock.calls.filter(
    ([called, init]) => called === path && init?.method === method,
  );

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
      if (path === '/game-systems') return Promise.resolve([]);
      if (path === '/campaigns/c/members') return Promise.resolve(members);
      if (path === '/campaigns/c/investigation-board')
        return Promise.resolve(board);
      if (path === '/campaigns/c/elements' && !init)
        return Promise.resolve(listFor(role));
      if (path === '/elements/shared' && !init)
        return Promise.resolve(sharedElement);
      if (path === '/elements/private' && !init)
        return Promise.resolve(privateElement);
      if (path === '/elements/player-note' && !init)
        return Promise.resolve(playerNote);
      if (path === '/elements/missing')
        return Promise.reject(
          new ApiError(404, 'resource.not_found', 'Not found', undefined),
        );
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
      if (path.endsWith('/access') && init?.method === 'PATCH') {
        const id = path.split('/')[2];
        const source = listFor('OWNER').find((item) => item.elementId === id);
        return Promise.resolve({
          ...source,
          ...JSON.parse(init.body as string),
        });
      }
      if (path.startsWith('/elements/') && init?.method === 'PATCH')
        return Promise.resolve({
          ...uploadedLocation,
          ...JSON.parse(init.body as string),
        });
      if (path === '/campaigns/c/elements' && init?.method === 'POST') {
        created = {
          ...privateElement,
          elementId: 'created',
          createdById: userId,
          ...JSON.parse(init.body as string),
        };
        return Promise.resolve(created);
      }
      if (path === '/elements/created' && !init)
        return Promise.resolve(created);
      if (path === '/campaigns/c/visit')
        return Promise.resolve({ newSinceAt: null });
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  it('groups the master list by type with counts and filters by access', async () => {
    renderPage();
    const groups = await within(
      await screen.findByRole('navigation', {
        name: 'Список материалов',
      }),
    ).findAllByRole('region');
    expect(
      groups.map((group) => group.getAttribute('aria-labelledby')),
    ).toEqual(['materials-group-NOTE', 'materials-group-PLAYER_NOTES']);
    expect(within(groups[0]).getByRole('heading')).toHaveTextContent(
      'Заметки2',
    );
    expect(within(groups[1]).getByRole('link')).toHaveTextContent(
      'My hunchМастеру',
    );
    // Every row carries its status as icon + word.
    expect(
      within(groups[0])
        .getAllByRole('link')
        .map((row) => row.textContent),
    ).toEqual(['SecretСкрыто', 'SharedОткрыто']);

    const filter = screen.getByRole('radiogroup', {
      name: 'Показать материалы',
    });
    expect(
      within(filter).getByRole('radio', { name: /^Все.*3$/ }),
    ).toBeChecked();
    fireEvent.click(
      within(filter).getByRole('radio', { name: /^Открыто.*1$/ }),
    );
    expect(
      within(list())
        .getAllByRole('link')
        .map((row) => row.textContent),
    ).toEqual(['SharedОткрыто']);
    fireEvent.click(within(filter).getByRole('radio', { name: /^Скрыто.*2$/ }));
    fireEvent.change(
      screen.getByPlaceholderText('Фильтр по названию и тексту'),
      {
        target: { value: 'tower' },
      },
    );
    expect(
      within(list())
        .getAllByRole('link')
        .map((row) => row.textContent),
    ).toEqual(['My hunchМастеру']);
  });

  it('sends players and viewers to the case, keeping the material', async () => {
    role = 'PLAYER';
    renderPage('/campaigns/c/elements/shared');
    expect(await screen.findByText('Case reader')).toBeInTheDocument();
    role = 'VIEWER';
    renderPage();
    expect(await screen.findByText('Case')).toBeInTheDocument();
  });

  it('reveals a hidden material only after a preview of what players get', async () => {
    renderPage('/campaigns/c/elements/private');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Открыть игрокам…' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Открыть игрокам материал «Secret»?',
    });
    const preview = within(dialog).getByRole('region', {
      name: 'Так увидят игроки',
    });
    expect(preview).toHaveTextContent('Hidden');
    expect(await within(dialog).findByText('Увидят 2 участника')).toBeVisible();
    expect(
      within(dialog).getByText('Player и наблюдатель Viewer'),
    ).toBeVisible();
    expect(calls('/elements/private/access', 'PATCH')).toHaveLength(0);

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Открыть игрокам' }),
    );
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/elements/private/access', {
        method: 'PATCH',
        body: JSON.stringify({ access: 'SHARED' }),
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Материал открыт игрокам',
    );
    expect(
      await screen.findByRole('button', { name: 'Скрыть от игроков…' }),
    ).toBeInTheDocument();
  });

  it('names how many cards and links hiding removes from the board', async () => {
    renderPage('/campaigns/c/elements/shared');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Скрыть от игроков…' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(
      await within(dialog).findByText('С доски уберутся 1 карточка и 2 связи.'),
    ).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(calls('/elements/shared/access', 'PATCH')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Скрыть от игроков…' }));
    fireEvent.click(
      await within(await screen.findByRole('dialog')).findByRole('button', {
        name: 'Скрыть от игроков',
      }),
    );
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/elements/shared/access', {
        method: 'PATCH',
        body: JSON.stringify({ access: 'MASTER_ONLY' }),
      }),
    );
  });

  it('shows a player note to the master as "to the master" without author controls', async () => {
    renderPage('/campaigns/c/elements/player-note');
    await screen.findByRole('heading', { name: 'My hunch' });
    expect(within(detail()).getByText('Мастеру')).toBeInTheDocument();
    expect(within(detail()).getByText('Автор: Player')).toBeInTheDocument();
    for (const name of ['Изменить', 'Ещё действия', 'Открыть игрокам…'])
      expect(
        within(detail()).queryByRole('button', { name }),
      ).not.toBeInTheDocument();
  });

  it('creates an NPC hidden from players with its required role', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Материал' }));
    const dialog = screen.getByRole('dialog', { name: 'Новый материал' });
    expect(within(dialog).queryByLabelText('Доступ')).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Тип'), {
      target: { value: 'NPC' },
    });
    fireEvent.change(within(dialog).getByLabelText('Название'), {
      target: { value: 'Keeper' },
    });
    fireEvent.change(within(dialog).getByLabelText('Роль'), {
      target: { value: 'Witness' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Создать' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/campaigns/c/elements', {
        method: 'POST',
        body: JSON.stringify({
          type: 'NPC',
          title: 'Keeper',
          content: '',
          access: 'MASTER_ONLY',
          typeData: { role: 'Witness' },
        }),
      }),
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

  it('autosaves an edited location and keeps its uploaded map', async () => {
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
    // Upload controls belong to editing.
    expect(screen.queryByLabelText('Обложка')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Изменить' }));
    expect(screen.getByLabelText('Обложка')).toHaveAttribute('type', 'file');
    expect(screen.getByLabelText('Файл карты')).toHaveAttribute('type', 'file');
    expect(screen.getByLabelText('HTTPS-адрес карты')).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent('Сохранено');

    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: 'Old plant' },
    });
    expect(screen.getByRole('status')).toHaveTextContent('Сохраняется…');
    // The map link is not sent, so the uploaded map stays.
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/elements/uploaded-location', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Old plant', content: '' }),
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Сохранено'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    expect(
      await screen.findByRole('heading', { name: 'Old plant' }),
    ).toBeInTheDocument();
  });

  it('keeps an invalid draft local and says what is missing', async () => {
    renderPage('/campaigns/c/elements/private');
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить' }));
    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: '  ' },
    });
    expect(screen.getByText('Введите название.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Не сохранено: заполните поля',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(calls('/elements/private', 'PATCH')).toHaveLength(0);
    expect(screen.getByLabelText('Название')).toBeInTheDocument();
  });

  it('deletes after the undo window, and undo brings the material back', async () => {
    renderPage('/campaigns/c/elements/private');
    await screen.findByRole('heading', { name: 'Secret' });
    fireEvent.click(screen.getByRole('button', { name: 'Ещё действия' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Удалить' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      '«Secret» будет удалён',
    );
    expect(within(list()).queryByText('Secret')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(within(list()).getByText('Secret')).toBeInTheDocument();
    expect(calls('/elements/private', 'DELETE')).toHaveLength(0);
  });

  it('shows a neutral state for a material that is not available', async () => {
    renderPage('/campaigns/c/elements/missing');
    expect(
      await screen.findByRole('heading', { name: 'Материал недоступен' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Возможно, ссылка устарела.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'К материалам' })).toHaveAttribute(
      'href',
      '/campaigns/c/elements',
    );
  });
});
