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
import { ToastProvider } from '../../components/ui/toast';
import { CasePage } from './case-page';

const request = vi.fn();
let role: 'OWNER' | 'PLAYER' | 'VIEWER' = 'PLAYER';
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({
    api: { request, requestBlob: vi.fn() },
    profile: { userId: 'player', name: 'Player' },
    signOut: vi.fn(),
  }),
}));

const master = { userId: 'master', name: 'Master' };
const at = (day: number, hour: number) =>
  new Date(2026, 8, day, hour).toISOString();
const base = {
  campaignId: 'c',
  access: 'SHARED',
  content: '',
  imageUrl: null,
  typeData: {},
  createdById: master.userId,
  createdBy: master,
};
const booth = {
  ...base,
  elementId: 'booth',
  type: 'LOCATION',
  title: 'Трансформаторная будка',
  content: 'Дверь **заперта** снаружи.',
  createdAt: at(20, 19),
  updatedAt: at(20, 19),
  sharedAt: at(20, 19),
};
const journal = {
  ...base,
  elementId: 'journal',
  type: 'NOTE',
  title: 'Запись в журнале',
  createdAt: at(20, 18),
  updatedAt: at(20, 18),
  sharedAt: at(20, 18),
};
const berg = {
  ...base,
  elementId: 'berg',
  type: 'NPC',
  title: 'Смотритель Берг',
  createdAt: at(14, 12),
  updatedAt: at(14, 12),
  sharedAt: at(14, 12),
};
const myNote = {
  ...base,
  elementId: 'my-note',
  type: 'NOTE',
  access: 'SHARED',
  title: 'Моя догадка',
  createdAt: at(21, 12),
  updatedAt: at(21, 12),
  createdById: 'player',
  createdBy: { userId: 'player', name: 'Player' },
};
const elements = [booth, journal, berg, myNote];
const board = {
  boardId: 'b',
  cards: [{ cardId: 'k1', reference: { kind: 'ELEMENT', elementId: 'berg' } }],
  links: [],
};
const template = {
  templateId: 'tftl',
  name: 'Kid',
  schema: {
    fields: [
      { key: 'upset', label: 'Upset', section: 'conditions', type: 'boolean' },
      {
        key: 'scared',
        label: 'Scared',
        section: 'conditions',
        type: 'boolean',
      },
    ],
  },
};
const character = {
  characterId: 'maya',
  campaignId: 'c',
  ownerId: 'player',
  templateId: 'tftl',
  name: 'Майя Стрём',
  description: 'Книжный червь',
  data: { scared: true, upset: false },
  isActive: true,
};

function renderPage(path = '/campaigns/c/case') {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/campaigns/:campaignId/case" element={<CasePage />} />
            <Route
              path="/campaigns/:campaignId/case/:elementId"
              element={<CasePage />}
            />
            <Route
              path="/campaigns/:campaignId/elements"
              element={<p>Materials</p>}
            />
            <Route
              path="/campaigns/:campaignId/notes/:elementId"
              element={<p>Note editor</p>}
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const main = () => screen.getByRole('region', { name: 'Дело' });

describe('CasePage', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    role = 'PLAYER';
    request.mockReset();
    request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/campaigns/c')
        return Promise.resolve({
          campaignId: 'c',
          title: 'Лето петли',
          system: 'tftl',
          currentUserRole: role,
          newSinceAt: at(19, 12),
          newVisibleMaterialCount: 2,
        });
      if (path === '/campaigns/c/visit')
        return Promise.resolve({ newSinceAt: at(19, 12) });
      if (path === '/game-systems') return Promise.resolve([]);
      if (path === '/campaigns/c/elements' && !init)
        return Promise.resolve(elements);
      if (path === '/campaigns/c/investigation-board')
        return Promise.resolve(board);
      if (path === '/campaigns/c/characters')
        return Promise.resolve([character]);
      if (path === '/game-systems/tftl/templates')
        return Promise.resolve([template]);
      if (path === '/elements/booth') return Promise.resolve(booth);
      if (path === '/elements/my-note') return Promise.resolve(myNote);
      if (path === '/campaigns/c/cards') return Promise.resolve({});
      if (path === '/campaigns/c/elements' && init?.method === 'POST')
        return Promise.resolve({
          ...myNote,
          elementId: 'quick',
          ...JSON.parse(init.body as string),
        });
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  it('shows newly opened materials since the last visit and the rest by day', async () => {
    renderPage();
    const recent = await screen.findByRole('region', {
      name: /Новое с прошлого визита · 19 сентября/,
    });
    expect(
      within(recent)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/campaigns/c/case/booth', '/campaigns/c/case/journal']);
    expect(within(recent).getByText('Дверь заперта снаружи.')).toBeVisible();
    const earlier = screen.getByRole('region', { name: 'Ранее' });
    expect(
      within(earlier).getByRole('region', { name: '14 сентября' }),
    ).toHaveTextContent('Смотритель БергNPC · на доске');
    // The reader's own notes live in "My notes", not in the case.
    expect(within(main()).queryByText('Моя догадка')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'NPC' }));
    expect(
      screen.queryByRole('region', { name: /Новое с прошлого визита/ }),
    ).toBeNull();
    expect(
      screen.getByRole('region', { name: '14 сентября' }),
    ).toHaveTextContent('Смотритель Берг');
    expect(screen.queryByText('Трансформаторная будка')).toBeNull();
  });

  it('saves a quick note with its first line as the title and the chosen audience', async () => {
    renderPage();
    const form = await screen.findByRole('form', { name: 'Быстрая заметка' });
    const save = within(form).getByRole('button', {
      name: 'Сохранить заметку',
    });
    expect(save).toBeDisabled();
    expect(within(form).getByRole('radio', { name: 'Личное' })).toBeChecked();
    fireEvent.change(within(form).getByLabelText('Быстрая заметка'), {
      target: { value: 'Кто взял ключ?\nСпросить у Рикарды' },
    });
    fireEvent.click(within(form).getByRole('radio', { name: 'Мастеру' }));
    fireEvent.click(save);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/campaigns/c/elements', {
        method: 'POST',
        body: JSON.stringify({
          type: 'NOTE',
          access: 'MASTER_ONLY',
          title: 'Кто взял ключ?',
          content: 'Спросить у Рикарды',
        }),
      }),
    );
    expect(
      await within(form).findByRole('link', { name: 'Открыть заметку' }),
    ).toHaveAttribute('href', '/campaigns/c/notes/quick');
    expect(within(form).getByLabelText('Быстрая заметка')).toHaveValue('');
    expect(within(form).getByRole('radio', { name: 'Личное' })).toBeChecked();
  });

  it('keeps the quick note draft when it moves into the phone sheet', async () => {
    renderPage();
    const form = await screen.findByRole('form', { name: 'Быстрая заметка' });
    fireEvent.change(within(form).getByLabelText('Быстрая заметка'), {
      target: { value: 'Гул за дверью' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Быстрая заметка' }));
    const sheet = screen.getByRole('dialog', { name: 'Быстрая заметка' });
    expect(within(sheet).getByRole('textbox')).toHaveValue('Гул за дверью');
  });

  it('shows my character with the conditions that are on', async () => {
    renderPage();
    const block = await screen.findByRole('region', { name: 'Мой персонаж' });
    expect(await within(block).findByText('Майя Стрём')).toBeVisible();
    const conditions = await within(block).findByRole('list', {
      name: 'Состояния персонажа',
    });
    expect(conditions).toHaveTextContent('Напуган(а)');
    expect(conditions).not.toHaveTextContent('Расстроен(а)');
  });

  it('lets a viewer read without notes or a character', async () => {
    role = 'VIEWER';
    renderPage();
    await screen.findByRole('region', { name: /Новое с прошлого визита/ });
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Мой персонаж' }),
    ).not.toBeInTheDocument();
  });

  it('opens a material to read and puts it on the board', async () => {
    renderPage('/campaigns/c/case/booth');
    const article = await screen.findByRole('article', {
      name: 'Трансформаторная будка',
    });
    expect(within(article).getByText('Автор: Master')).toBeInTheDocument();
    expect(
      within(article).queryByRole('button', { name: 'Изменить' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(article).getByRole('button', { name: 'Добавить на доску' }),
    );
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/campaigns/c/cards', {
        method: 'POST',
        body: JSON.stringify({
          cardKind: 'ELEMENT_REFERENCE',
          elementId: 'booth',
        }),
      }),
    );
    fireEvent.click(within(article).getByRole('button', { name: 'Заметка' }));
    expect(
      screen.getByRole('dialog', { name: 'Быстрая заметка' }),
    ).toBeInTheDocument();
  });

  it('sends the reader’s own note to its editor', async () => {
    renderPage('/campaigns/c/case/my-note');
    expect(await screen.findByText('Note editor')).toBeInTheDocument();
  });

  it('sends the master to the materials list', async () => {
    role = 'OWNER';
    renderPage();
    expect(await screen.findByText('Materials')).toBeInTheDocument();
  });
});
