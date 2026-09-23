import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { ApiError, Board, Campaign } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import {
  CampaignBackgroundLayer,
  useCampaignBackground,
} from './use-campaign-background';
import { CampaignWorkspaceShell } from './campaign-workspace-shell';

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
          <span>{profile?.name ?? profile?.email}</span>
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
          <button onClick={openCreate}>{t('campaigns.newCampaign')}</button>
        </header>
        {isCreating ? (
          <section className="campaign-create-wrap">
            <form className="campaign-create-card" onSubmit={create}>
              <div className="section-heading">
                <h2>{t('campaigns.newCampaign')}</h2>
                <button
                  className="button-ghost"
                  onClick={() => {
                    setCreating(false);
                    setError(undefined);
                  }}
                  type="button"
                >
                  {t('common.cancel')}
                </button>
              </div>
              <label>
                {t('campaigns.campaignTitle')}
                <input name="title" required />
              </label>
              <label>
                {t('campaigns.description')}
                <textarea name="description" />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button>{t('campaigns.create')}</button>
            </form>
          </section>
        ) : campaigns.isLoading ? (
          <section className="campaign-page-state" aria-live="polite">
            <p>{t('common.loading')}</p>
          </section>
        ) : campaigns.data?.length ? (
          <section className="campaign-grid" aria-live="polite">
            {campaigns.data.map((campaign) => (
              <article className="campaign-card" key={campaign.campaignId}>
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
                  <Link to={`/campaigns/${campaign.campaignId}`}>
                    {t('campaigns.open')}
                  </Link>
                </footer>
              </article>
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

export function CampaignWorkspacePage({
  section,
}: {
  section: 'overview' | 'board';
}) {
  const { campaignId } = useParams();
  const { api, profile, signOut } = useAuth();
  const { t } = useTranslation();
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.request<Campaign>(`/campaigns/${campaignId}`),
    enabled: Boolean(campaignId),
    retry: false,
  });
  const board = useQuery({
    queryKey: ['board', campaignId],
    queryFn: () =>
      api.request<Board>(`/campaigns/${campaignId}/investigation-board`),
    enabled: Boolean(campaignId) && section === 'board',
    retry: false,
  });

  const data = campaign.data;
  const background = useCampaignBackground(
    campaignId,
    data?.backgroundConfig,
    data?.currentUserRole,
  );
  if (campaign.isError)
    return (
      <main className="page-state" role="alert">
        {t('errors.resource.not_found')}
      </main>
    );
  const basePath = `/campaigns/${campaignId}`;

  return (
    <CampaignWorkspaceShell campaign={data}>
      {section === 'overview' ? (
        <section className="workspace-overview panel">
          {(data?.currentUserRole === 'OWNER' ||
            data?.currentUserRole === 'PLAYER') && (
            <CampaignBackgroundLayer background={background} />
          )}
          <div className="workspace-overview-content">
            <h2>{t('workspace.summary')}</h2>
            <p>{data?.description || '—'}</p>
            <dl>
              <dt>{t('workspace.system')}</dt>
              <dd>{data?.system ?? '—'}</dd>
            </dl>
            <Link className="button-link" to={`${basePath}/board`}>
              {t('workspace.openBoard')}
            </Link>
            <p className="muted">{t('workspace.comingSoon')}</p>
          </div>
        </section>
      ) : (
        <section className="board-preview">
          {board.isError ? (
            <p>{t('workspace.boardUnavailable')}</p>
          ) : board.isLoading ? (
            <p>{t('common.loading')}</p>
          ) : board.data?.cards.length ? (
            board.data.cards.map((card) => (
              <article
                key={card.cardId}
                style={{ borderLeftColor: card.color ?? undefined }}
              >
                <strong>{card.title}</strong>
                <p>{card.content}</p>
                <small>{card.tags.join(', ')}</small>
              </article>
            ))
          ) : (
            <p>{t('workspace.boardEmpty')}</p>
          )}
        </section>
      )}
    </CampaignWorkspaceShell>
  );
}
