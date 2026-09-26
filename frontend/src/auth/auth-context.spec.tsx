import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './auth-context';

type Api = ReturnType<typeof useAuth>['api'];

let captured: Api | undefined;
function Probe() {
  const { api, profile } = useAuth();
  captured = api;
  return <p>{profile ? `signed in as ${profile.email}` : 'signed out'}</p>;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('AuthProvider', () => {
  let issued: string[];
  let validToken: string;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    captured = undefined;
    issued = [];
    // The server accepts only the most recently issued access token, like an
    // expired JWT after a refresh.
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        validToken = `token-${issued.length + 1}`;
        issued.push(validToken);
        return json({ accessToken: validToken });
      }
      const header = (init?.headers as Record<string, string> | undefined)
        ?.Authorization;
      if (header !== `Bearer ${validToken}`) {
        return json(
          { code: 'auth.invalid_token', message: 'Unauthorized' },
          401,
        );
      }
      if (url.endsWith('/auth/me'))
        return json({ userId: 'u1', email: 'kim@example.test' });
      return json({ ok: url });
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  async function signedIn() {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(
      await screen.findByText('signed in as kim@example.test'),
    ).toBeInTheDocument();
    return captured!;
  }

  it('retries a request with the refreshed token after the access token expires', async () => {
    const api = await signedIn();
    // The access token expires on the server side.
    validToken = 'expired-for-everyone';

    await expect(api.request('/campaigns')).resolves.toEqual({
      ok: '/api/campaigns',
    });
    expect(issued).toEqual(['token-1', 'token-2']);
  });

  it('refreshes once for a burst of parallel 401 responses', async () => {
    const api = await signedIn();
    validToken = 'expired-for-everyone';

    let results: unknown[] = [];
    await act(async () => {
      results = await Promise.all([
        api.request('/campaigns'),
        api.request('/game-systems'),
        api.request('/users/me'),
      ]);
    });

    expect(results).toHaveLength(3);
    expect(issued).toEqual(['token-1', 'token-2']);
  });

  it('signs out when the refresh session is gone', async () => {
    const api = await signedIn();
    validToken = 'expired-for-everyone';
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/auth/refresh')
        ? json({ code: 'auth.invalid_token', message: 'Unauthorized' }, 401)
        : json({ code: 'auth.invalid_token', message: 'Unauthorized' }, 401),
    );

    await expect(api.request('/campaigns')).rejects.toMatchObject({
      status: 401,
    });
    await waitFor(() =>
      expect(screen.getByText('signed out')).toBeInTheDocument(),
    );
  });
});
