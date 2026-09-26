import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from './client';

describe('ApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('refreshes once and retries a protected request after 401', async () => {
    let token: string | null = 'expired-access-token';
    const refresh = vi.fn(async () => {
      token = 'fresh-access-token';
      return token;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ campaignId: 'campaign-1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const api = new ApiClient(() => token, refresh);
    await expect(api.request<{ campaignId: string }>('/campaigns/campaign-1')).resolves.toEqual({
      campaignId: 'campaign-1',
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({
      Authorization: 'Bearer fresh-access-token',
    });
  });

  it('does not retry a request after its retry also returns 401', async () => {
    const refresh = vi.fn(async () => 'fresh-access-token');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const api = new ApiClient(() => 'expired-access-token', refresh);
    await expect(api.request('/campaigns/campaign-1')).rejects.toBeInstanceOf(ApiError);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns undefined for no-content responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const api = new ApiClient(() => 'access-token', async () => null);

    await expect(api.request<void>('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('returns undefined for a successful response with an empty body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 200 })));
    const api = new ApiClient(() => 'access-token', async () => null);

    await expect(
      api.request<void>('/campaigns/campaign-1', { method: 'DELETE' }),
    ).resolves.toBeUndefined();
  });

  it('maps an error body to its stable code and violations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            statusCode: 400,
            code: 'validation.failed',
            message: 'Request validation failed',
            violations: [{ field: 'title', code: 'validation.required' }],
          }),
          { status: 400 },
        ),
      ),
    );
    const api = new ApiClient(() => 'access-token', async () => null);

    await expect(api.request('/campaigns', { method: 'POST' })).rejects.toMatchObject({
      status: 400,
      code: 'validation.failed',
      violations: [{ field: 'title', code: 'validation.required' }],
    });
  });

  it('falls back to internal.error when the error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })),
    );
    const api = new ApiClient(() => 'access-token', async () => null);

    await expect(api.request('/campaigns')).rejects.toMatchObject({
      status: 502,
      code: 'internal.error',
    });
  });
});
