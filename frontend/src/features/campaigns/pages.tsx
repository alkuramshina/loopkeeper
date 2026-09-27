import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { ApiError, Campaign, GameSystem } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { ModalDialog } from '../../components/modal-dialog';
import { ProtectedImage } from '../../components/protected-image';
import { errorMessage } from '../../components/page-error';
import { OfflineNotice } from '../../components/offline-notice';
import { Logo } from '../../components/brand/logo';
import { Avatar } from '../../components/avatar';
import { ImageIcon, Link2, Plus } from 'lucide-react';
import { invitationToken } from './invitation-token';

function apiErrorMessage(cause: unknown, t: TFunction) {
  return cause instanceof ApiError
    ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') })
    : t('errors.unexpected');
}

export function CampaignListPage() {
  const { t } = useTranslation();
  const { api, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const [isCreating, setCreating] = useState(false);
  const [invitationValue, setInvitationValue] = useState('');
  const [invitationError, setInvitationError] = useState(false);
  const campaigns = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.request<Campaign[]>('/campaigns'),
  });
  const gameSystems = useQuery({
    queryKey: ['game-systems'],
    queryFn: () => api.request<GameSystem[]>('/game-systems'),
  });

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    try {
      const campaign = await api.request<Campaign>('/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          title: form.get('title'),
          description: form.get('description'),
          system: form.get('system'),
        }),
      });
      queryClient.setQueryData<Campaign[]>(['campaigns'], (items = []) => [
        campaign,
        ...items,
      ]);
      setCreating(false);
    } catch (cause) {
      setError(apiErrorMessage(cause, t));
    }
  }

  const openCreate = () => {
    setError(undefined);
    setCreating(true);
  };

  function openInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = invitationToken(invitationValue);
    if (!token) {
      setInvitationError(true);
      return;
    }
    setInvitationError(false);
    void navigate(`/invitations/${encodeURIComponent(token)}`);
  }

  return (
    <main className="campaign-page">
      <header className="campaign-topbar">
        <Link className="brand-lock" to="/campaigns">
          <Logo label={t('appName')} />
        </Link>
        <details className="campaign-list-account">
          <summary>
            <span>{t('account.title')}</span>
            <Avatar
              alt=""
              seed={profile?.name || profile?.email || ''}
              size="small"
            />
          </summary>
          <div>
            <Link to="/settings/account">
              {profile?.name || profile?.email}
            </Link>
            <button type="button" onClick={() => void signOut()}>
              {t('auth.signOut')}
            </button>
          </div>
        </details>
      </header>
      <section className="campaigns-bg">
        <OfflineNotice />
        <header className="campaigns-top">
          <div>
            <h1>{t('campaigns.title')}</h1>
            <p className="campaigns-intro">{t('campaigns.intro')}</p>
          </div>
          {campaigns.data?.length ? (
            <button onClick={openCreate}>
              <Plus aria-hidden="true" size={18} />
              {t('campaigns.newCampaign')}
            </button>
          ) : null}
        </header>
        {isCreating ? (
          <ModalDialog
            onClose={() => {
              setCreating(false);
              setError(undefined);
            }}
            title={t('campaigns.newCampaign')}
          >
            <form
              className="campaign-create-card"
              onSubmit={(event) => void create(event)}
            >
              <label>
                {t('campaigns.campaignTitle')}
                <input name="title" required />
              </label>
              <label>
                {t('campaigns.system')}
                <select name="system" required defaultValue="">
                  <option disabled value="">
                    {t('campaigns.selectSystem')}
                  </option>
                  {gameSystems.data?.map((system) => (
                    <option key={system.slug} value={system.slug}>
                      {system.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('campaigns.description')}
                <textarea name="description" required />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button>{t('campaigns.create')}</button>
            </form>
          </ModalDialog>
        ) : campaigns.isError && !campaigns.data ? (
          // A failed load must not look like an empty list.
          <section className="campaign-page-state">
            <p role="alert">
              {t('campaigns.loadFailed')} {errorMessage(campaigns.error, t)}
            </p>
            <button onClick={() => void campaigns.refetch()}>
              {t('common.retry')}
            </button>
          </section>
        ) : campaigns.isLoading ? (
          <section className="campaign-page-state" aria-live="polite">
            <p>{t('common.loading')}</p>
          </section>
        ) : campaigns.data?.length ? (
          <section className="campaign-grid" aria-live="polite">
            {campaigns.data.map((campaign) => (
              <Link
                className="campaign-card"
                key={campaign.campaignId}
                to={`/campaigns/${campaign.campaignId}`}
              >
                <div className="campaign-card-media">
                  {campaign.coverUrl ? (
                    <ProtectedImage
                      alt=""
                      className="campaign-cover"
                      imageUrl={campaign.coverUrl}
                    />
                  ) : (
                    <ImageIcon aria-hidden="true" size={26} strokeWidth={1.5} />
                  )}
                </div>
                <div className="campaign-card-body">
                  <div className="campaign-card-heading">
                    <h2>{campaign.title}</h2>
                    <span
                      className={`campaign-role campaign-role-${campaign.currentUserRole.toLowerCase()}`}
                    >
                      {t(`workspace.roles.${campaign.currentUserRole}`)}
                    </span>
                  </div>
                  <p className="campaign-system">
                    {gameSystems.data?.find(
                      (system) => system.slug === campaign.system,
                    )?.name ||
                      campaign.system ||
                      t('campaigns.systemFallback')}
                  </p>
                  <p className="campaign-card-description">
                    {campaign.description || t('campaigns.descriptionFallback')}
                  </p>
                </div>
              </Link>
            ))}
          </section>
        ) : (
          <section className="campaign-empty-state" aria-live="polite">
            <div className="campaign-empty-symbol" aria-hidden="true">
              +
            </div>
            <h2>{t('campaigns.emptyTitle')}</h2>
            <p>{t('campaigns.empty')}</p>
            <button onClick={openCreate}>{t('campaigns.firstCampaign')}</button>
          </section>
        )}
        <form className="campaign-invitation" onSubmit={openInvitation}>
          <Link2 aria-hidden="true" size={18} />
          <div>
            <strong>{t('campaigns.haveInvitation')}</strong>
            <span>{t('campaigns.pasteInvitation')}</span>
          </div>
          <label className="campaign-invitation-input">
            <span className="sr-only">{t('campaigns.invitationLink')}</span>
            <input
              value={invitationValue}
              onChange={(event) => {
                setInvitationValue(event.target.value);
                setInvitationError(false);
              }}
              placeholder={t('campaigns.invitationPlaceholder')}
            />
          </label>
          <button type="submit">{t('campaigns.join')}</button>
          {invitationError && <p role="alert">{t('auth.invitationInvalid')}</p>}
        </form>
      </section>
    </main>
  );
}
