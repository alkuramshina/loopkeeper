import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Campaign } from '../../api/client';
import { useAuth } from '../../auth/auth-context';

const recorded = new Map<string, number>();
const visitGapMs = 60 * 60 * 1000;

export function useCampaignVisit(campaign?: Campaign) {
  const { api, profile } = useAuth();
  const queryClient = useQueryClient();
  const campaignId = campaign?.campaignId;
  const userId = profile?.userId;

  useEffect(() => {
    if (!campaignId || !userId) return;
    const key = `${userId}:${campaignId}`;
    const now = Date.now();
    if (now - (recorded.get(key) ?? 0) < visitGapMs) return;
    recorded.set(key, now);
    void Promise.resolve()
      .then(() =>
        api.request<{ newSinceAt: string | null }>(
          `/campaigns/${campaignId}/visit`,
          {
            method: 'POST',
          },
        ),
      )
      .then(({ newSinceAt }) => {
        queryClient.setQueryData<Campaign>(
          ['campaign', campaignId],
          (current) => (current ? { ...current, newSinceAt } : current),
        );
        void queryClient.invalidateQueries({
          queryKey: ['campaign', campaignId],
        });
        void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      })
      .catch(() => recorded.delete(key));
  }, [api, campaignId, queryClient, userId]);
}
