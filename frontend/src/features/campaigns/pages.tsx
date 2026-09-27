import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { ApiError, Campaign, GameSystem } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { ModalDialog } from '../../components/modal-dialog';
import { ProtectedImage } from '../../components/protected-image';
import { errorMessage } from '../../components/page-error';
import { OfflineNotice } from '../../components/offline-notice';
import { AppTopbar } from '../../components/app-topbar';
import { ImageIcon, Plus } from 'lucide-react';
import './new-since-visit.css';

function apiErrorMessage(cause: unknown, t: TFunction) {
  return cause instanceof ApiError
    ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') })
    : t('errors.unexpected');
}

export function CampaignListPage() {
  const { t } = useTranslation();
  const { api } = useAuth();
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
          description: form.get('description') || undefined,
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
    <main className="app-page">
      <AppTopbar />
      <section className="campaigns-bg">
        <OfflineNotice />
        <header className="campaigns-top">
          <h1>{t('campaigns.title')}</h1>
          {campaigns.data?.length ? (
            <button
              aria-label={t('campaigns.createCampaign')}
              onClick={openCreate}
            >
              <Plus aria-hidden="true" size={18} />
              {t('campaigns.create')}
            </button>
          ) : null}
        </header>
        {isCreating && (
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
                <textarea maxLength={1000} name="description" />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button>{t('campaigns.create')}</button>
            </form>
          </ModalDialog>
        )}
        {campaigns.isError && !campaigns.data ? (
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
                  {campaign.description && (
                    <p className="campaign-card-description">
                      {campaign.description}
                    </p>
                  )}
                  {(campaign.newVisibleMaterialCount ?? 0) > 0 && (
                    <p className="campaign-card-new">
                      {t('campaigns.newMaterials', {
                        count: campaign.newVisibleMaterialCount,
                      })}
                    </p>
                  )}
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
      </section>
    </main>
  );
}
