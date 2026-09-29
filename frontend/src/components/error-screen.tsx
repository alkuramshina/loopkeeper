import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { FileQuestion, TriangleAlert, WifiOff } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import { AuthLayout } from '../auth/auth-layout';
import { AppShell } from './app-shell';
import { Button } from './ui/button';
import { EmptyState } from './ui/empty-state';

export type ErrorKind = 'unavailable' | 'network' | 'unexpected';

const kindIcons: Record<ErrorKind, LucideIcon> = {
  unavailable: FileQuestion,
  network: WifiOff,
  unexpected: TriangleAlert,
};

type ErrorScreenProps = {
  kind: ErrorKind;
  /** Overrides the kind's default heading. */
  title?: string;
  /** What happened; announced to assistive technology. */
  message: string;
  /** A retry for failures that may pass; "unavailable" never gets one. */
  onRetry?: () => void;
  /** Names the retry when it is more than a new request, e.g. a reload. */
  retryLabel?: string;
  /** Replaces the default way out ("My campaigns" or "Sign in"). */
  action?: ReactNode;
};

function useErrorTexts({
  kind,
  title,
  onRetry,
  retryLabel,
  action,
}: ErrorScreenProps) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const heading = title ?? t(`errorScreen.titles.${kind}`);
  const hint =
    kind === 'unavailable' ? t('errorScreen.unavailableHint') : undefined;
  const actions = (
    <div className="error-screen-actions">
      {onRetry && (
        <Button onClick={onRetry} variant="primary">
          {retryLabel ?? t('common.retry')}
        </Button>
      )}
      {action ??
        (profile ? (
          <Link
            className={`ui-button ui-button-md ${onRetry ? 'ui-button-secondary' : 'ui-button-primary'}`}
            to="/campaigns"
          >
            {t('errorScreen.toCampaigns')}
          </Link>
        ) : (
          <Link
            className="ui-button ui-button-primary ui-button-md"
            to="/sign-in"
          >
            {t('errorScreen.toSignIn')}
          </Link>
        ))}
    </div>
  );
  return { heading, hint, actions, signedIn: Boolean(profile) };
}

/**
 * The failed state inside a page that already has its frame (a detail pane,
 * a campaign screen): what happened and the next step.
 */
export function ErrorScreen(props: ErrorScreenProps) {
  const { heading, hint, actions } = useErrorTexts(props);
  const Icon = kindIcons[props.kind];
  return (
    <div className="error-screen">
      <EmptyState
        action={actions}
        title={heading}
        visual={<Icon aria-hidden="true" size={40} strokeWidth={1.5} />}
      >
        <p role="alert">{props.message}</p>
        {hint && <p>{hint}</p>}
      </EmptyState>
    </div>
  );
}

/**
 * A whole screen that could not be shown. A signed-in person keeps the app
 * frame (logo, profile, way back to campaigns); a guest sees the sign-in
 * frame.
 */
export function ErrorPage(props: ErrorScreenProps) {
  const { t } = useTranslation();
  const { heading, hint, actions, signedIn } = useErrorTexts(props);
  if (signedIn)
    return (
      <AppShell sidebarLabel={t('campaigns.navigation')}>
        <ErrorScreen {...props} />
      </AppShell>
    );
  return (
    <AuthLayout title={heading}>
      <p className="auth-error" role="alert">
        {props.message}
      </p>
      {hint && <p className="auth-intro">{hint}</p>}
      {actions}
    </AuthLayout>
  );
}
