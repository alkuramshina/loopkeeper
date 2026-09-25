import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { ElementsPage } from './elements-page';

const request = vi.fn();
let role: 'OWNER' | 'PLAYER' | 'VIEWER' = 'OWNER';
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({
    api: { request },
    profile: { userId: 'user' },
    signOut: vi.fn(),
  }),
}));
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
};
const sharedElement = {
  ...privateElement,
  elementId: 'shared',
  access: 'SHARED',
  title: 'Shared',
  content: '**Visible**',
};

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
    request.mockReset();
    request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/campaigns/c')
        return Promise.resolve({
          campaignId: 'c',
          title: 'Campaign',
          currentUserRole: role,
        });
      if (path === '/campaigns/c/elements' && !init)
        return Promise.resolve([privateElement, sharedElement]);
      if (path === '/elements/shared') return Promise.resolve(sharedElement);
      if (path === '/elements/private') return Promise.resolve(privateElement);
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
      if (path === '/elements/private/publish' && init?.method === 'POST')
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

  it('shows only shared elements to viewers without management or board controls', async () => {
    role = 'VIEWER';
    renderPage('/campaigns/c/elements/shared');
    expect(
      await screen.findByRole('heading', { name: 'Shared' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Новый элемент' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Добавить на доску' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Доска расследования' }),
    ).not.toBeInTheDocument();
  });

  it('publishes a master-only element via the dedicated endpoint', async () => {
    renderPage('/campaigns/c/elements/private');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Открыть участникам' }),
    );
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/elements/private/publish', {
        method: 'POST',
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
