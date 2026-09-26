import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { CampaignListPage } from './pages';

const request = vi.fn();
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({
    api: { request, requestBlob: vi.fn() },
    profile: { userId: 'u1', name: 'Kim' },
    signOut: vi.fn(),
  }),
}));

const systems = [{ slug: 'TALES_FROM_THE_LOOP', name: 'Tales from the Loop' }];

function renderList() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <CampaignListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function answer(campaigns: () => Promise<unknown>) {
  request.mockImplementation((path: string) =>
    path === '/game-systems' ? Promise.resolve(systems) : campaigns(),
  );
}

describe('CampaignListPage', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    request.mockReset();
  });

  it('shows loading while campaigns are on their way', () => {
    answer(() => new Promise(() => undefined));
    renderList();
    expect(screen.getByText('Загрузка…')).toBeInTheDocument();
  });

  it('offers exactly one create action on an empty list', async () => {
    answer(() => Promise.resolve([]));
    renderList();
    expect(
      await screen.findByText('Здесь пока нет кампаний'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /кампани/i })).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not disguise a failed load as an empty list and retries it', async () => {
    let attempts = 0;
    answer(() =>
      ++attempts === 1
        ? Promise.reject(new TypeError('Failed to fetch'))
        : Promise.resolve([
            {
              campaignId: 'c',
              title: 'Сигнал из леса',
              currentUserRole: 'VIEWER',
            },
          ]),
    );
    renderList();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось загрузить кампании. Нет связи с сервером.',
    );
    expect(
      screen.queryByText('Здесь пока нет кампаний'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    const card = await screen.findByRole('link', { name: /Сигнал из леса/ });
    expect(card).toHaveAttribute('href', '/campaigns/c');
    expect(within(card).getByText('Наблюдатель')).toBeInTheDocument();
    expect(within(card).getByText('Описание кампании ещё не добавлено.')).toBeInTheDocument();
  });

  it('creates a campaign and puts it on top of the list', async () => {
    answer(() => Promise.resolve([]));
    request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/game-systems') return Promise.resolve(systems);
      if (init?.method === 'POST')
        return Promise.resolve({
          campaignId: 'new',
          currentUserRole: 'OWNER',
          ...JSON.parse(init.body as string),
        });
      return Promise.resolve([]);
    });
    renderList();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Создать первую кампанию' }),
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Название'), {
      target: { value: 'Остров' },
    });
    fireEvent.change(within(dialog).getByLabelText('Игровая система'), {
      target: { value: 'TALES_FROM_THE_LOOP' },
    });
    fireEvent.change(within(dialog).getByLabelText('Описание'), {
      target: { value: 'Лето 1985 года.' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Создать кампанию' }),
    );

    const card = await screen.findByRole('link', { name: /Остров/ });
    expect(within(card).getByText('Мастер')).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith('/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Остров',
        description: 'Лето 1985 года.',
        system: 'TALES_FROM_THE_LOOP',
      }),
    });
  });
});
