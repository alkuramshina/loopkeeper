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
import { BackgroundSettingsPage } from './background-settings-page';

const request = vi.fn();
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({
    api: {
      request,
      requestBlob: vi.fn().mockRejectedValue(new Error('No media server')),
    },
    profile: { userId: 'owner' },
  }),
}));

const background = {
  backgroundId: '11111111-1111-4111-8111-111111111111',
  name: 'Forest',
  imageUrl: 'https://example.com/forest.jpg',
  isEnabled: true,
  sortOrder: 0,
};

function renderPage() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter
        initialEntries={['/campaigns/campaign-1/settings/backgrounds']}
      >
        <Routes>
          <Route
            path="/campaigns/:campaignId/settings/backgrounds"
            element={<BackgroundSettingsPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BackgroundSettingsPage', () => {
  beforeEach(() => {
    request.mockReset();
    request.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/campaigns/campaign-1')
        return Promise.resolve({
          campaignId: 'campaign-1',
          title: 'Campaign',
          currentUserRole: 'OWNER',
        });
      if (path.endsWith('/background-settings') && init?.method === 'PATCH') {
        return Promise.resolve(JSON.parse(init.body as string));
      }
      if (path.endsWith('/background-settings'))
        return Promise.resolve({
          selectionMode: 'FIXED',
          fixedBackgroundId: null,
          backgrounds: [background],
        });
      if (init?.method === 'POST')
        return Promise.resolve({
          ...background,
          backgroundId: '22222222-2222-4222-8222-222222222222',
          name: 'Background 2',
          imageUrl: '/media/22222222-2222-4222-8222-222222222222',
        });
      if (init?.method === 'DELETE') return Promise.resolve(undefined);
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  it('shows the gallery and safe-area preview, uploads and deletes a local image', async () => {
    renderPage();
    const gallery = await screen.findByLabelText('Галерея фонов');
    expect(
      within(gallery).getByRole('link', { name: 'Forest' }),
    ).toHaveAttribute('href', `#background-${background.backgroundId}`);
    expect(screen.getByLabelText('Предпросмотр фона')).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText('Загрузить изображение с устройства'),
      {
        target: {
          files: [new File(['image'], 'forest.png', { type: 'image/png' })],
        },
      },
    );
    const imageUrl = '/media/22222222-2222-4222-8222-222222222222';
    await waitFor(() =>
      expect(
        screen.getAllByLabelText(
          'HTTPS-адрес изображения или локальный файл',
        )[1],
      ).toHaveValue(imageUrl),
    );
    const endpoint = '/campaigns/campaign-1/backgrounds';
    expect(request).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[1]);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        `${endpoint}/22222222-2222-4222-8222-222222222222`,
        { method: 'DELETE' },
      ),
    );
    expect(screen.getAllByLabelText('Предпросмотр фона')).toHaveLength(1);
  });
});
