import {
  act,
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
import { ToastProvider } from '../../components/ui/toast';
import { NotesPage } from './notes-page';

const request = vi.fn();
let role: 'OWNER' | 'PLAYER' | 'VIEWER' = 'PLAYER';
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({
    api: { request, requestBlob: vi.fn() },
    profile: { userId: 'player', name: 'Player' },
    signOut: vi.fn(),
  }),
}));

const player = { userId: 'player', name: 'Player' };
const note = (id: string, extra: Record<string, unknown> = {}) => ({
  elementId: id,
  campaignId: 'c',
  type: 'NOTE',
  access: 'PRIVATE',
  title: id,
  content: '',
  imageUrl: null,
  typeData: {},
  createdAt: '2026-09-20T10:00:00.000Z',
  updatedAt: '2026-09-20T10:00:00.000Z',
  createdById: player.userId,
  createdBy: player,
  ...extra,
});
const key = note('key', {
  title: 'Ключ от будки',
  access: 'SHARED',
  content: 'Берг сдал **ключ**',
  updatedAt: '2026-09-21T10:00:00.000Z',
});
const hunch = note('hunch', { title: 'Подозрения', content: 'Рикарда' });
const masterNote = note('master-note', {
  access: 'SHARED',
  createdById: 'master',
  createdBy: { userId: 'master', name: 'Master' },
});
let stored: Record<string, ReturnType<typeof note>>;

function renderPage(path = '/campaigns/c/notes') {
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
              path="/campaigns/:campaignId/notes"
              element={<NotesPage />}
            />
            <Route
              path="/campaigns/:campaignId/notes/:elementId"
              element={<NotesPage />}
            />
            <Route
              path="/campaigns/:campaignId/case/:elementId"
              element={<p>Case reader</p>}
            />
            <Route path="/campaigns/:campaignId/case" element={<p>Case</p>} />
            <Route
              path="/campaigns/:campaignId/elements"
              element={<p>Materials</p>}
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const list = () => screen.getByRole('navigation', { name: 'Список заметок' });
const editor = () => screen.getByRole('article');

describe('NotesPage', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    role = 'PLAYER';
    stored = { key, hunch, 'master-note': masterNote };
    request.mockReset();
    request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/campaigns/c')
        return Promise.resolve({
          campaignId: 'c',
          title: 'Лето петли',
          currentUserRole: role,
        });
      if (path === '/game-systems') return Promise.resolve([]);
      if (path === '/campaigns/c/elements' && !init)
        return Promise.resolve(Object.values(stored));
      if (path === '/campaigns/c/investigation-board')
        return Promise.resolve({ boardId: 'b', cards: [], links: [] });
      if (path === '/campaigns/c/members') return Promise.resolve([]);
      if (path === '/campaigns/c/cards') return Promise.resolve({});
      if (path === '/campaigns/c/elements' && init?.method === 'POST') {
        stored.created = note('created', JSON.parse(init.body as string));
        return Promise.resolve(stored.created);
      }
      const [, , id, action] = path.split('/');
      if (path.startsWith('/elements/') && !init)
        return Promise.resolve(stored[id]);
      if (init?.method === 'PATCH') {
        stored[id] = {
          ...stored[id],
          ...JSON.parse(init.body as string),
          ...(action ? {} : { updatedAt: '2026-09-21T19:58:00.000Z' }),
        };
        return Promise.resolve(stored[id]);
      }
      if (init?.method === 'DELETE') return Promise.resolve(undefined);
      if (path === '/campaigns/c/views') return Promise.resolve(undefined);
      if (path === '/campaigns/c/visit')
        return Promise.resolve({ lastVisitAt: null });
      throw new Error(`Unexpected request: ${path}`);
    });
  });
  afterEach(() => vi.useRealTimers());

  it('lists only the reader’s notes with their visibility, the last edited first', async () => {
    renderPage();
    await screen.findByText('Ключ от будки');
    expect(
      within(list())
        .getAllByRole('link')
        .map((row) => row.textContent),
    ).toEqual(['Ключ от будкиВсемБерг сдал ключ', 'ПодозренияЛичноеРикарда']);
    expect(screen.getByText('Выберите заметку в списке.')).toBeVisible();
  });

  it('creates a note at once and opens it with the title ready to type', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Заметка' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/campaigns/c/elements', {
        method: 'POST',
        body: JSON.stringify({
          type: 'NOTE',
          title: 'Новая заметка',
          content: '',
          access: 'PRIVATE',
        }),
      }),
    );
    const title = await screen.findByLabelText('Название');
    expect(title).toHaveValue('Новая заметка');
    expect(title).toHaveFocus();
  });

  it('autosaves the text and formats the selection with the buttons', async () => {
    renderPage('/campaigns/c/notes/hunch');
    const text = await within(
      await screen.findByRole('article'),
    ).findByLabelText('Текст');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.change(text, { target: { value: 'Рикарда спокойна' } });
    (text as HTMLTextAreaElement).setSelectionRange(0, 7);
    fireEvent.click(screen.getByRole('button', { name: 'Жирный (Ctrl+B)' }));
    expect(text).toHaveValue('**Рикарда** спокойна');
    await act(() => vi.advanceTimersByTimeAsync(800));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/elements/hunch', {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Подозрения',
          content: '**Рикарда** спокойна',
        }),
      }),
    );
    expect(await within(editor()).findByRole('status')).toHaveTextContent(
      /Сохранено · \d\d:\d\d/,
    );
  });

  it('changes visibility at once, but asks before showing a note to everyone', async () => {
    renderPage('/campaigns/c/notes/hunch');
    const visibility = await screen.findByRole('radiogroup', {
      name: 'Кто видит',
    });
    expect(screen.getByText('Видите только вы')).toBeVisible();
    // Only a note for everyone can go on the board.
    expect(
      screen.queryByRole('button', { name: 'Добавить на доску' }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(visibility).getByRole('radio', { name: 'Мастеру' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/elements/hunch/access', {
        method: 'PATCH',
        body: JSON.stringify({ access: 'MASTER_ONLY' }),
      }),
    );

    fireEvent.click(within(visibility).getByRole('radio', { name: 'Всем' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Показать заметку «Подозрения» всем?',
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Показать всем' }),
    );
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/elements/hunch/access', {
        method: 'PATCH',
        body: JSON.stringify({ access: 'SHARED' }),
      }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Добавить на доску' }),
    );
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/campaigns/c/cards', {
        method: 'POST',
        body: JSON.stringify({
          cardKind: 'ELEMENT_REFERENCE',
          elementId: 'hunch',
        }),
      }),
    );
  });

  it('deletes after the undo window, and undo brings the note back', async () => {
    renderPage('/campaigns/c/notes/hunch');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Ещё действия' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Удалить' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      '«Подозрения» будет удалён',
    );
    expect(within(list()).queryByText('Подозрения')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(await within(list()).findByText('Подозрения')).toBeVisible();
    expect(
      request.mock.calls.filter(([, init]) => init?.method === 'DELETE'),
    ).toHaveLength(0);
  });

  it('sends somebody else’s note to the case, a viewer and the master away', async () => {
    const view = renderPage('/campaigns/c/notes/master-note');
    expect(await screen.findByText('Case reader')).toBeInTheDocument();
    view.unmount();
    role = 'VIEWER';
    const viewer = renderPage();
    expect(await screen.findByText('Case')).toBeInTheDocument();
    viewer.unmount();
    role = 'OWNER';
    renderPage();
    expect(await screen.findByText('Materials')).toBeInTheDocument();
  });
});
