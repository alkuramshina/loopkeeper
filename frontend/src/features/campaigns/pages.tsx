import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { ApiError, Campaign, GameSystem } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { ModalDialog } from '../../components/modal-dialog';

function apiErrorMessage(cause: unknown, t: TFunction) {
  return cause instanceof ApiError
    ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') })
    : t('errors.unexpected');
}

export function CampaignListPage() {
  const { t } = useTranslation();
  const { api, profile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const [isCreating, setCreating] = useState(false);
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

  return (
    <main className="campaign-page">
      <header className="campaign-topbar">
        <Link className="brand-lock" to="/campaigns">
          <span className="brand-mark" aria-hidden="true" />
          {t('appName')}
        </Link>
        <div className="campaign-account">
          <Link to="/settings/account">{profile?.name ?? profile?.email}</Link>
          <button className="button-ghost" onClick={() => void signOut()}>
            {t('auth.signOut')}
          </button>
        </div>
      </header>
      <section className="campaigns-bg">
        <header className="campaigns-top">
          <div>
            <p className="kicker">{t('campaigns.kicker')}</p>
            <h1>{t('campaigns.chooseWorkspace')}</h1>
            <p className="campaigns-intro">{t('campaigns.intro')}</p>
          </div>
          {campaigns.data?.length ? (
            <button onClick={openCreate}>{t('campaigns.newCampaign')}</button>
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
            <form className="campaign-create-card" onSubmit={create}>
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
                <p className="campaign-system">
                  {campaign.system ?? t('campaigns.systemFallback')}
                </p>
                <h2>{campaign.title}</h2>
                <p>
                  {campaign.description || t('campaigns.descriptionFallback')}
                </p>
                <footer>
                  <span
                    className={`campaign-role campaign-role-${campaign.currentUserRole.toLowerCase()}`}
                  >
                    {t(`workspace.roles.${campaign.currentUserRole}`)}
                  </span>
                  <span>{t('campaigns.open')}</span>
                </footer>
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
      </section>
    </main>
  );
}
