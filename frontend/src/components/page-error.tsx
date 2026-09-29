import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client';
import { ErrorPage, ErrorScreen } from './error-screen';

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
 * State for a page that could not load. A missing or forbidden resource stays
 * tenant-neutral; any other failure says what happened and offers a retry
 * instead of pretending the resource does not exist. By default it is a whole
 * screen in the app frame; `inline` fits it into a page that has one.
 */
export function PageError({
  error,
  unavailableKey = 'errors.resource.not_found',
  onRetry,
  inline = false,
}: {
  error?: unknown;
  unavailableKey?: string;
  onRetry?: () => void;
  inline?: boolean;
}) {
  const { t } = useTranslation();
  const unavailable =
    error === undefined ||
    (error instanceof ApiError &&
      (error.status === 404 || error.status === 403));
  const kind = unavailable
    ? 'unavailable'
    : isNetworkError(error)
      ? 'network'
      : 'unexpected';
  const props = {
    kind,
    message: unavailable ? t(unavailableKey) : errorMessage(error, t),
    onRetry: unavailable ? undefined : onRetry,
  } as const;
  return inline ? <ErrorScreen {...props} /> : <ErrorPage {...props} />;
}
