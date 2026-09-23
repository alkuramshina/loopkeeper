import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError, Board, Campaign } from '../../api/client';
import { useAuth } from '../../auth/auth-context';

export function CampaignListPage() {
  const { t } = useTranslation(); const { api, profile, signOut } = useAuth(); const client = useQueryClient(); const [error, setError] = useState<string>();
  const campaigns = useQuery({ queryKey: ['campaigns'], queryFn: () => api.request<Campaign[]>('/campaigns') });
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); try { const campaign = await api.request<Campaign>('/campaigns', { method: 'POST', body: JSON.stringify({ title: form.get('title'), description: form.get('description') }) }); client.setQueryData<Campaign[]>(['campaigns'], (items = []) => [campaign, ...items]); event.currentTarget.reset(); } catch (cause) { setError(cause instanceof ApiError ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') }) : t('errors.unexpected')); } }
  return <main className="app-page"><header className="topbar"><strong>Loopkeeper</strong><span>{profile?.name ?? profile?.email}</span><button className="button-ghost" onClick={() => void signOut()}>{t('auth.signOut')}</button></header><section className="page-header"><p className="kicker">{t('appName')}</p><h1>{t('campaigns.title')}</h1></section><div className="campaign-layout"><section className="campaign-list">{campaigns.isLoading ? <p>Загрузка…</p> : campaigns.data?.length ? campaigns.data.map((campaign) => <article className="campaign-card" key={campaign.campaignId}><h2>{campaign.title}</h2><p>{campaign.description}</p><Link to={`/campaigns/${campaign.campaignId}`}>{t('campaigns.open')}</Link></article>) : <p>{t('campaigns.empty')}</p>}</section><form className="panel" onSubmit={create}><h2>{t('campaigns.newCampaign')}</h2><label>{t('campaigns.campaignTitle')}<input name="title" required /></label><label>{t('campaigns.description')}<textarea name="description" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button>{t('campaigns.create')}</button></form></div></main>;
}

export function CampaignWorkspacePage() {
  const { campaignId } = useParams(); const { api } = useAuth(); const { t } = useTranslation();
  const campaign = useQuery({ queryKey: ['campaign', campaignId], queryFn: () => api.request<Campaign>(`/campaigns/${campaignId}`), enabled: Boolean(campaignId) });
  const board = useQuery({ queryKey: ['board', campaignId], queryFn: () => api.request<Board>(`/campaigns/${campaignId}/investigation-board`), enabled: Boolean(campaignId), retry: false });
  return <main className="app-page"><header className="topbar"><Link to="/campaigns">Loopkeeper</Link><span>{campaign.data?.title}</span></header><nav className="workspace-nav"><span>{t('workspace.overview')}</span><span>{t('workspace.characters')}</span><span>{t('workspace.notes')}</span><span>{t('workspace.members')}</span></nav><section className="page-header"><p className="kicker">{t('workspace.board')}</p><h1>{campaign.data?.title ?? '…'}</h1></section>{board.isError ? <p className="panel">{t('workspace.boardUnavailable')}</p> : <section className="board-preview">{board.isLoading ? <p>Загрузка…</p> : board.data?.cards.length ? board.data.cards.map((card) => <article key={card.cardId} style={{ borderLeftColor: card.color ?? undefined }}><strong>{card.title}</strong><p>{card.content}</p><small>{card.tags.join(', ')}</small></article>) : <p>{t('workspace.boardEmpty')}</p>}</section>}</main>;
}
