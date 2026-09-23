const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type ApiErrorBody = {
  statusCode: number;
  code: string;
  message: string;
  violations?: Array<{ field: string; code: string }>;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly violations: ApiErrorBody['violations'],
  ) {
    super(message);
  }
}

type AccessTokenProvider = () => string | null;
type RefreshAccessToken = () => Promise<string | null>;

export class ApiClient {
  constructor(
    private readonly getToken: AccessTokenProvider,
    private readonly refreshAccessToken: RefreshAccessToken,
  ) {}

  async request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(this.getToken() ? { Authorization: `Bearer ${this.getToken()}` } : {}),
        ...init.headers,
      },
    });

    if (response.status === 401 && !retried && path !== '/auth/refresh') {
      const token = await this.refreshAccessToken();
      if (token) {
        return this.request<T>(path, init, true);
      }
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null) as ApiErrorBody | null;
      throw new ApiError(
        response.status,
        body?.code ?? 'internal.error',
        body?.message ?? 'An unexpected error occurred',
        body?.violations,
      );
    }

    return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
  }
}

export type Profile = { userId: string; email: string; name?: string };
export type AuthResponse = { accessToken: string };
export type Campaign = {
  campaignId: string;
  title: string;
  description?: string | null;
  system?: string | null;
  currentUserRole: 'OWNER' | 'PLAYER' | 'VIEWER';
};
export type Board = {
  boardId: string;
  cards: Array<{ cardId: string; title: string; content?: string | null; tags: string[]; color?: string | null }>;
};

export type CharacterField = {
  key: string;
  label: string;
  section?: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  options?: string[];
};

export type CharacterTemplate = {
  templateId: string;
  name: string;
  schema: {
    title?: string;
    sections?: Array<{ key: string; label: string }>;
    fields: CharacterField[];
  };
};

export type Character = {
  characterId: string;
  campaignId: string;
  ownerId: string;
  templateId: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  data: Record<string, unknown>;
  isNPC: boolean;
  isActive: boolean;
};
