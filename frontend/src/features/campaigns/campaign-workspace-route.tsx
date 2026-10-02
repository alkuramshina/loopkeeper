import { Suspense } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Campaign } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { PageError } from '../../components/page-error';
import { CampaignWorkspaceShell } from './campaign-workspace-shell';
import { QuickNoteProvider } from './quick-note-context';

export function CampaignWorkspaceRoute() {
  const { campaignId } = useParams();
  const { api, profile } = useAuth();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.request<Campaign>(`/campaigns/${campaignId}`),
    retry: false,
  });
  if (campaign.isError)
    return (
      <PageError
        error={campaign.error}
        unavailableKey="workspace.boardUnavailable"
        onRetry={() => void campaign.refetch()}
      />
    );
  if (!campaign.data || !profile)
    return <main className="page-state">{t('common.loading')}</main>;
  const section = pathname.split('/')[3];
  if (
    ['members', 'invitations', 'settings'].includes(section) &&
    campaign.data.currentUserRole !== 'OWNER'
  )
    return <PageError />;
  const width =
    section === 'settings'
      ? 'narrow'
      : ['members', 'invitations'].includes(section)
        ? 'default'
        : 'full';
  return (
    <QuickNoteProvider
      campaign={campaign.data}
      key={`${profile.userId}:${campaignId}`}
    >
      <CampaignWorkspaceShell campaign={campaign.data} width={width}>
        <Suspense
          fallback={<p className="page-state">{t('common.loading')}</p>}
        >
          <Outlet />
        </Suspense>
      </CampaignWorkspaceShell>
    </QuickNoteProvider>
  );
}
