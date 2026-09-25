const API_URL = import.meta.env.VITE_API_URL ?? '/api';

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

  async requestBlob(
    path: string,
    init: RequestInit = {},
    retried = false,
  ): Promise<Blob> {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(this.getToken() ? { Authorization: `Bearer ${this.getToken()}` } : {}),
        ...init.headers,
      },
    });

    if (response.status === 401 && !retried && path !== '/auth/refresh') {
      const token = await this.refreshAccessToken();
      if (token) return this.requestBlob(path, init, true);
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
      throw new ApiError(
        response.status,
        body?.code ?? 'internal.error',
        body?.message ?? 'An unexpected error occurred',
        body?.violations,
      );
    }

    return response.blob();
  }

  async request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body && !(init.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
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

export type Profile = {
  userId: string;
  email: string;
  name?: string;
  avatarUrl?: string | null;
};
export type AuthResponse = { accessToken: string };
export type CampaignBackground = {
  backgroundId: string;
  name: string;
  imageUrl: string;
  isEnabled: boolean;
  sortOrder: number;
};

export type CampaignBackgroundConfig = {
  selectionMode: 'FIXED' | 'RANDOM';
  fixedBackgroundId: string | null;
  backgrounds: CampaignBackground[];
};

export type GameSystem = {
  slug: string;
  name: string;
  description?: string | null;
};

export type Campaign = {
  campaignId: string;
  title: string;
  description?: string | null;
  system?: string | null;
  currentUserRole: 'OWNER' | 'PLAYER' | 'VIEWER';
  backgroundConfig?: CampaignBackgroundConfig;
  coverUrl?: string | null;
};

export type CampaignElementType = 'NOTE' | 'LOCATION' | 'NPC' | 'OTHER';
export type CampaignElementAccess = 'MASTER_ONLY' | 'SHARED';
export type CampaignElement = {
  elementId: string;
  campaignId: string;
  type: CampaignElementType;
  access: CampaignElementAccess;
  title: string;
  content: string | null;
  imageUrl: string | null;
  typeData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
export type CampaignElementInput = Pick<CampaignElement, 'type' | 'access' | 'title' | 'content'> & {
  imageUrl?: string | null;
  typeData?: Record<string, unknown>;
};
export type BoardCard = {
  cardId: string;
  cardKind: 'FREE' | 'ELEMENT_REFERENCE' | 'CHARACTER_REFERENCE';
  title: string;
  content?: string | null;
  tags: string[];
  color?: string | null;
  icon?: string | null;
  node?: { x: number; y: number; width: number; height: number } | null;
  reference?: { kind: 'ELEMENT' | 'CHARACTER'; elementId?: string; characterId?: string };
};

export type BoardLink = {
  linkId: string;
  fromCardId: string;
  toCardId: string;
  label?: string | null;
};

export type Board = {
  boardId: string;
  cards: BoardCard[];
  links: BoardLink[];
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

  isActive: boolean;
};

export type CampaignMember = {
  memberId: string;
  campaignId: string;
  campaignRole: 'PLAYER' | 'VIEWER';
  user: { userId: string; email: string; name?: string | null; avatarUrl?: string | null };
};

export type CampaignInvitation = {
  invitationId: string;
  campaignId: string;
  role: 'PLAYER' | 'VIEWER';
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  createdById: string;
};

export type CreatedCampaignInvitation = CampaignInvitation & { token: string };
