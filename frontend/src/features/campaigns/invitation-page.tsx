import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { AppShell } from '../../components/app-shell';
import { ErrorPage } from '../../components/error-screen';
import { errorMessage, isNetworkError } from '../../components/page-error';

/**
 * Joining a campaign by link. Only a signed-in person gets here (guests go
 * through sign-in first), so the page keeps the app frame.
 */
export function InvitationPage() {
  const { token } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>();
  const acceptedToken = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!token || acceptedToken.current === token) return;
    acceptedToken.current = token;
    setError(undefined);
    void api
      .request<{ campaignId: string }>(
        `/invitations/${encodeURIComponent(token)}/accept`,
        { method: 'POST' },
      )
      .then((membership) =>
        navigate(`/campaigns/${membership.campaignId}`, { replace: true }),
      )
      .catch((cause: unknown) => setError(cause ?? new Error('unknown')));
  }, [api, navigate, token]);

  if (error)
    return (
      <ErrorPage
        kind={
          isNetworkError(error)
            ? 'network'
            : error instanceof ApiError && error.status === 404
              ? 'unavailable'
              : 'unexpected'
        }
        message={errorMessage(error, t)}
        title={t('invitations.failedTitle')}
      />
    );
  return (
    <AppShell sidebarLabel={t('campaigns.navigation')}>
      <div className="error-screen">
        <p className="invitation-accepting" role="status">
          {t('invitations.accepting')}
        </p>
      </div>
    </AppShell>
  );
}
