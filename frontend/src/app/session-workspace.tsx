import { useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import { ToastProvider } from '../components/ui/toast';
import { RouteErrorBoundary } from './error-boundary';
import { AppRouter } from './router';

/** Server snapshots and notifications never carry over to another account. */
export function SessionWorkspace() {
  const { profile } = useAuth();
  const userId = profile?.userId;
  const client = useMemo(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
    [userId],
  );
  return (
    <QueryClientProvider client={client} key={userId ?? 'anonymous'}>
      <ToastProvider>
        <RouteErrorBoundary>
          <AppRouter />
        </RouteErrorBoundary>
      </ToastProvider>
    </QueryClientProvider>
  );
}
