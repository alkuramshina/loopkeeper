const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export class ApiClient {
  constructor(private readonly getToken: () => string | null) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new ApiError(response.status, Array.isArray(error.message) ? error.message.join(', ') : error.message);
    }
    return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
  }
}

export type Campaign = { campaignId: string; title: string; description?: string };
export type Board = { boardId: string; cards: Array<{ cardId: string; title: string; content?: string; tags: string[]; color?: string; icon?: string; node?: { x: number; y: number } }>; links: Array<{ linkId: string; fromCardId: string; toCardId: string; label?: string }> };
