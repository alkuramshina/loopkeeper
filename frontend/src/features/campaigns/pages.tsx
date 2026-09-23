import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, NavLink, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { ApiError, Board, Campaign } from '../../api/client';
import { useAuth } from '../../auth/auth-context';

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
      event.currentTarget.reset();
    } catch (cause) {
      setError(apiErrorMessage(cause, t));
    }
  }

  return (
    <main className="app-page">
      <header className="topbar">
        <strong>Loopkeeper</strong>
        <span>{profile?.name ?? profile?.email}</span>
        <button className="button-ghost" onClick={() => void signOut()}>
          {t('auth.signOut')}
        </button>
      </header>
      <section className="page-header">
        <p className="kicker">{t('appName')}</p>
        <h1>{t('campaigns.title')}</h1>
      </section>
      <div className="campaign-layout">
        <section className="campaign-list" aria-live="polite">
          {campaigns.isLoading ? (
            <p>{t('common.loading')}</p>
          ) : campaigns.data?.length ? (
            campaigns.data.map((campaign) => (
              <article className="campaign-card" key={campaign.campaignId}>
                <h2>{campaign.title}</h2>
                <p>{campaign.description}</p>
                <p className="role-badge">
                  {t(`workspace.roles.${campaign.currentUserRole}`)}
                </p>
                <Link to={`/campaigns/${campaign.campaignId}`}>
                  {t('campaigns.open')}
                </Link>
              </article>
            ))
          ) : (
            <p>{t('campaigns.empty')}</p>
          )}
        </section>
        <form className="panel" onSubmit={create}>
          <h2>{t('campaigns.newCampaign')}</h2>
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
      </div>
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

  if (campaign.isError)
    return (
      <main className="page-state" role="alert">
        {t('errors.resource.not_found')}
      </main>
    );
  const data = campaign.data;
  const basePath = `/campaigns/${campaignId}`;

  return (
    <main className="app-page">
      <header className="topbar">
        <Link to="/campaigns">Loopkeeper</Link>
        <span>{profile?.name ?? profile?.email}</span>
        <button className="button-ghost" onClick={() => void signOut()}>
          {t('auth.signOut')}
        </button>
      </header>
      <section className="workspace-heading">
        <Link className="back-link" to="/campaigns">
          ← {t('workspace.backToCampaigns')}
        </Link>
        <div>
          <p className="kicker">
            {data ? t(`workspace.roles.${data.currentUserRole}`) : '…'}
          </p>
          <h1>{data?.title ?? '…'}</h1>
        </div>
        <p className="role-badge">
          {t('workspace.role')}:{' '}
          {data && t(`workspace.roles.${data.currentUserRole}`)}
        </p>
      </section>
      <nav className="workspace-nav" aria-label={t('campaigns.title')}>
        <NavLink end to={basePath}>
          {t('workspace.overview')}
        </NavLink>
        <NavLink to={`${basePath}/board`}>{t('workspace.board')}</NavLink>
        <NavLink to={`${basePath}/characters`}>
          {t('workspace.characters')}
        </NavLink>
        <NavLink to={`${basePath}/notes`}>{t('workspace.notes')}</NavLink>
        {data?.currentUserRole === 'OWNER' && (
          <NavLink to={`${basePath}/members`}>{t('workspace.members')}</NavLink>
        )}
      </nav>
      {section === 'overview' ? (
        <section className="workspace-overview panel">
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
    </main>
  );
}
