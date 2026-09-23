import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/auth-context';

export function InvitationPage() {
  const { token } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!token) return;
    void api.request<{ campaignId: string }>(`/invitations/${encodeURIComponent(token)}/accept`, { method: 'POST' })
      .then((membership) => navigate(`/campaigns/${membership.campaignId}`, { replace: true }))
      .catch((cause) => setError(cause instanceof ApiError ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') }) : t('errors.unexpected')));
  }, [api, navigate, t, token]);

  return <main className="auth-page"><section className="auth-card"><p className="kicker">{t('appName')}</p><h1>{t('invitations.title')}</h1>{error ? <><p className="form-error" role="alert">{error}</p><Link to="/campaigns">{t('campaigns.title')}</Link></> : <p>{t('invitations.accepting')}</p>}</section></main>;
}
