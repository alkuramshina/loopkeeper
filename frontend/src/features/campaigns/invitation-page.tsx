import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { AuthLayout } from '../../auth/auth-layout';

export function InvitationPage() {
  const { token } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
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
      .catch((cause) =>
        setError(
          cause instanceof ApiError
            ? t(`errors.${cause.code}`, {
                defaultValue: t('errors.unexpected'),
              })
            : t('errors.unexpected'),
        ),
      );
  }, [api, navigate, t, token]);

  // The same frame as sign-in: the invitation flow starts there.
  return (
    <AuthLayout title={t('invitations.title')}>
      {error ? (
        <>
          <p className="auth-error auth-invitation-error" role="alert">
            {error}
          </p>
          <Link
            className="ui-button ui-button-primary ui-button-lg auth-action"
            to="/campaigns"
          >
            {t('invitations.toCampaigns')}
          </Link>
        </>
      ) : (
        <p className="auth-intro" role="status">
          {t('invitations.accepting')}
        </p>
      )}
    </AuthLayout>
  );
}
