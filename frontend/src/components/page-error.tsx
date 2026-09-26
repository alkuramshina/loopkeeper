import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { ApiError } from '../api/client';

/** A request that never reached the API (offline, DNS, CORS) has no ApiError. */
export function isNetworkError(cause: unknown): boolean {
  return !(cause instanceof ApiError);
}

export function errorMessage(cause: unknown, t: TFunction): string {
  if (isNetworkError(cause)) return t('errors.network');
  return t(`errors.${(cause as ApiError).code}`, {
    defaultValue: t('errors.unexpected'),
  });
}

/**
 * Full-page state for a page that could not load. A missing or forbidden
 * resource stays tenant-neutral; any other failure says what happened and
 * offers a retry instead of pretending the resource does not exist.
 */
export function PageError({
  error,
  unavailableKey = 'errors.resource.not_found',
  onRetry,
}: {
  error?: unknown;
  unavailableKey?: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const unavailable =
    error === undefined ||
    (error instanceof ApiError &&
      (error.status === 404 || error.status === 403));

  return (
    <main className="page-state">
      <p role="alert">
        {unavailable ? t(unavailableKey) : errorMessage(error, t)}
      </p>
      {!unavailable && onRetry && (
        <button type="button" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </main>
  );
}
