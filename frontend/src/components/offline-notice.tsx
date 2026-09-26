import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

/**
 * While the browser is offline, TanStack Query pauses queries and mutations
 * instead of failing them and resumes them on reconnect. Without this notice a
 * refresh or a save would silently do nothing.
 */
export function OfflineNotice() {
  const { t } = useTranslation();
  const online = useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
  );
  if (online) return null;
  return (
    <p className="form-error offline-notice" role="status">
      {t('errors.offline')}
    </p>
  );
}
