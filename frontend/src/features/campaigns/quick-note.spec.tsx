import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { Campaign } from '../../api/client';
import { ToastProvider } from '../../components/ui/toast';
import { QuickNoteProvider, readQuickNote } from './quick-note-context';
import { noteProfile } from './quick-note';
import { CampaignWorkspaceShell } from './campaign-workspace-shell';

const request = vi.fn();
let userId = 'player';
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({
    api: { request },
    profile: { userId, name: 'Player' },
    signOut: vi.fn(),
  }),
}));
const campaign: Campaign = {
  campaignId: 'c',
  title: 'Lake mystery',
  currentUserRole: 'PLAYER',
};
function tree(role: Campaign['currentUserRole'] = 'PLAYER', id = 'c') {
  const value = { ...campaign, campaignId: id, currentUserRole: role };
  return (
    <QuickNoteProvider key={`${userId}:${id}`} campaign={value}>
      <CampaignWorkspaceShell campaign={value}>
        <button>Board action</button>
      </CampaignWorkspaceShell>
    </QuickNoteProvider>
  );
}
function setup(role: Campaign['currentUserRole'] = 'PLAYER', id = 'c') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ToastProvider>{children}</ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(tree(role, id), { wrapper });
}
const open = () =>
  fireEvent.click(screen.getByRole('button', { name: /Заметка\s*Alt\+N/ }));
const form = () => screen.getByRole('form', { name: 'Быстрая заметка' });
const input = () => within(form()).getByRole('textbox');
const save = () => fireEvent.submit(form());
describe('Campaign quick notes', () => {
  beforeEach(() => {
    userId = 'player';
    sessionStorage.clear();
    localStorage.clear();
    request.mockReset();
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('1280'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    request.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'POST' && path.endsWith('/elements'))
        return Promise.resolve({
          elementId: 'created',
          campaignId: 'c',
          ...JSON.parse(init.body as string),
        });
      return Promise.resolve([]);
    });
  });
  it('defines the role matrix including an unloaded role', () => {
    expect(noteProfile('OWNER')).toMatchObject({
      accessOptions: ['MASTER_ONLY', 'SHARED'],
      defaultAccess: 'MASTER_ONLY',
      showCharacter: false,
    });
    expect(noteProfile('PLAYER')).toMatchObject({
      accessOptions: ['PRIVATE', 'MASTER_ONLY', 'SHARED'],
      defaultAccess: 'PRIVATE',
      showCharacter: true,
    });
    expect(noteProfile('VIEWER')).toBeNull();
    expect(noteProfile()).toBeNull();
  });
  it('validates storage, normalizes access after a role change and tolerates unavailable storage', () => {
    const profile = noteProfile('OWNER')!;
    sessionStorage.setItem(
      'key',
      JSON.stringify({ text: 'A thought', access: 'PRIVATE' }),
    );
    expect(readQuickNote('key', profile)).toEqual({
      text: 'A thought',
      access: 'MASTER_ONLY',
    });
    sessionStorage.setItem(
      'key',
      JSON.stringify({ text: 2, access: 'SHARED' }),
    );
    expect(readQuickNote('key', profile).text).toBe('');
    const unavailable = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('denied');
      });
    expect(readQuickNote('key', profile).access).toBe('MASTER_ONLY');
    unavailable.mockRestore();
  });
  it('saves an owner note, links to it and resets its audience without requesting characters', async () => {
    setup('OWNER');
    open();
    expect(within(form()).queryByRole('radio', { name: 'Личное' })).toBeNull();
    expect(
      within(form()).getByRole('radio', { name: 'Только мне' }),
    ).toBeChecked();
    fireEvent.change(input(), { target: { value: 'First line\nSecond line' } });
    fireEvent.click(within(form()).getByRole('radio', { name: 'Всем' }));
    fireEvent.click(screen.getByRole('button', { name: 'Закрепить' }));
    save();
    expect(
      await screen.findByRole('link', { name: 'Открыть заметку' }),
    ).toHaveAttribute('href', '/campaigns/c/notes/created');
    expect(input()).toHaveValue('');
    expect(
      within(form()).getByRole('radio', { name: 'Только мне' }),
    ).toBeChecked();
    expect(
      request.mock.calls.some(([path]) => path.endsWith('/characters')),
    ).toBe(false);
    expect(request).toHaveBeenCalledWith('/campaigns/c/elements', {
      method: 'POST',
      body: JSON.stringify({
        type: 'NOTE',
        access: 'SHARED',
        title: 'First line',
        content: 'Second line',
      }),
    });
  });
  it('keeps a failed draft and blocks duplicate submission and editing while pending', async () => {
    let reject!: (cause: unknown) => void;
    request.mockImplementation((path: string, init?: RequestInit) =>
      init?.method === 'POST' && path.endsWith('/elements')
        ? new Promise((_, fail) => {
            reject = fail;
          })
        : Promise.resolve([]),
    );
    setup();
    open();
    fireEvent.change(input(), { target: { value: 'Pending thought' } });
    save();
    save();
    expect(input()).toHaveAttribute('readonly');
    expect(within(form()).getByRole('radio', { name: 'Всем' })).toBeDisabled();
    expect(
      request.mock.calls.filter(
        ([path, init]) => path.endsWith('/elements') && init?.method === 'POST',
      ),
    ).toHaveLength(1);
    await act(async () => {
      reject(new TypeError('network'));
      await Promise.resolve();
    });
    expect(input()).toHaveValue('Pending thought');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
  it('isolates accounts and campaigns and ignores late responses in a new context', async () => {
    let resolve!: (note: unknown) => void;
    request.mockImplementation((path: string, init?: RequestInit) =>
      init?.method === 'POST' && path.endsWith('/elements')
        ? new Promise((done) => {
            resolve = done;
          })
        : Promise.resolve([]),
    );
    const view = setup();
    open();
    fireEvent.change(input(), { target: { value: 'Old campaign' } });
    save();
    view.rerender(tree('PLAYER', 'other'));
    open();
    fireEvent.change(input(), { target: { value: 'New campaign' } });
    await act(async () => {
      resolve({ elementId: 'old', campaignId: 'c' });
      await Promise.resolve();
    });
    expect(input()).toHaveValue('New campaign');
    expect(screen.queryByRole('link', { name: 'Открыть заметку' })).toBeNull();
    userId = 'another';
    view.rerender(tree('PLAYER', 'other'));
    open();
    expect(input()).toHaveValue('');
  });
  it('closes and hides the draft on demotion and restores it when writing is allowed again', async () => {
    const view = setup();
    open();
    fireEvent.change(input(), { target: { value: 'Private thought' } });
    view.rerender(tree('VIEWER'));
    expect(screen.queryByRole('form')).toBeNull();
    fireEvent.keyDown(window, { code: 'KeyN', key: 'Dead', altKey: true });
    expect(screen.queryByRole('form')).toBeNull();
    view.rerender(tree());
    open();
    expect(input()).toHaveValue('Private thought');
    await waitFor(() =>
      expect(sessionStorage.getItem('quick-note:player:c')).toContain(
        'Private thought',
      ),
    );
  });
  it('search hands focus to the note and Escape respects a modal dialog', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Найти/ }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Быстрая заметка',
      }),
    );
    await waitFor(() => expect(input()).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: /Найти/ }));
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(form()).toBeInTheDocument();
  });
  it('loads a stored draft when an initial viewer regains permission to write', () => {
    sessionStorage.setItem(
      'quick-note:player:c',
      JSON.stringify({ text: 'Earlier thought', access: 'PRIVATE' }),
    );
    const view = setup('VIEWER');
    expect(screen.queryByRole('form')).toBeNull();
    view.rerender(tree());
    open();
    expect(input()).toHaveValue('Earlier thought');
  });
  it('keeps in-memory text when storage is unavailable and never steals focus from the board after a pinned save', async () => {
    const storage = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('denied');
      });
    let resolve!: (note: unknown) => void;
    request.mockImplementation((path: string, init?: RequestInit) =>
      init?.method === 'POST' && path.endsWith('/elements')
        ? new Promise((done) => {
            resolve = done;
          })
        : Promise.resolve([]),
    );
    const view = setup();
    open();
    await waitFor(() => expect(input()).toHaveFocus());
    fireEvent.change(input(), { target: { value: 'Remember in memory' } });
    view.rerender(tree());
    expect(input()).toHaveValue('Remember in memory');
    fireEvent.click(screen.getByRole('button', { name: 'Закрепить' }));
    save();
    const board = screen.getByRole('button', { name: 'Board action' });
    board.focus();
    await act(async () => {
      resolve({ elementId: 'created', campaignId: 'c' });
      await Promise.resolve();
    });
    expect(board).toHaveFocus();
    expect(input()).toHaveValue('');
    storage.mockRestore();
  });
});
