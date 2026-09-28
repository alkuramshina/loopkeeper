import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { TFunction } from 'i18next';
import { ApiError, Campaign } from '../../api/client';
import { useAuth } from '../../auth/auth-context';

/** Roles the master can grant; the master role itself is never granted. */
export const assignableRoles = ['PLAYER', 'VIEWER'] as const;

export function apiErrorMessage(cause: unknown, t: TFunction) {
  return cause instanceof ApiError
    ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') })
    : t('errors.unexpected');
}

/** The campaign of a master-only page; other roles get no data queries. */
export function useOwnerCampaign() {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.request<Campaign>(`/campaigns/${campaignId}`),
    enabled: Boolean(campaignId),
    retry: false,
  });
  return {
    campaignId,
    campaign,
    isOwner: campaign.data?.currentUserRole === 'OWNER',
  };
}
