import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ApiClient, AuthResponse, Profile } from '../api/client';

type AuthState = {
  profile: Profile | null;
  loading: boolean;
  api: ApiClient;
  signIn: (payload: { email: string; password: string }) => Promise<void>;
  signUp: (payload: {
    email: string;
    password: string;
    name?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const anonymousApi = new ApiClient(
        () => null,
        async () => null,
      );
      const result = await anonymousApi.request<AuthResponse>('/auth/refresh', {
        method: 'POST',
      });
      setAccessToken(result.accessToken);
      const refreshedApi = new ApiClient(() => result.accessToken, refresh);
      setProfile(await refreshedApi.request<Profile>('/auth/me'));
      return result.accessToken;
    } catch {
      setAccessToken(null);
      setProfile(null);
      return null;
    }
  }, []);

  const api = useMemo(
    () => new ApiClient(() => accessToken, refresh),
    [accessToken, refresh],
  );

  const authenticate = useCallback(
    async (path: string, body: Record<string, string | undefined>) => {
      const anonymousApi = new ApiClient(
        () => null,
        async () => null,
      );
      const result = await anonymousApi.request<AuthResponse>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setAccessToken(result.accessToken);
      const authenticatedApi = new ApiClient(() => result.accessToken, refresh);
      setProfile(await authenticatedApi.request<Profile>('/auth/me'));
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    await api
      .request<void>('/auth/logout', { method: 'POST' })
      .catch(() => undefined);
    setAccessToken(null);
    setProfile(null);
  }, [api]);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  return (
    <AuthContext.Provider
      value={{
        profile,
        loading,
        api,
        signIn: (body) => authenticate('/auth/login', body),
        signUp: (body) => authenticate('/auth/register', body),
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
