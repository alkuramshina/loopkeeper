import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CampaignMember } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { CampaignWorkspaceShell } from './campaign-workspace-shell';
import { PageHeader } from '../../components/page-header';
import { Avatar } from '../../components/avatar';
import { PageError } from '../../components/page-error';
import {
  apiErrorMessage,
  assignableRoles,
  useOwnerCampaign,
} from './members-shared';
import './workspace-settings.css';

export function MembersPage() {
  const { campaignId, campaign, isOwner } = useOwnerCampaign();
  const { api } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const members = useQuery({
    queryKey: ['members', campaignId],
    queryFn: () =>
      api.request<CampaignMember[]>(`/campaigns/${campaignId}/members`),
    enabled: Boolean(campaignId) && isOwner,
    retry: false,
  });

  const updateMember = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.request<CampaignMember>(
        `/campaigns/${campaignId}/members/${userId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ role }),
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members', campaignId] });
      setError(undefined);
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      api.request<void>(`/campaigns/${campaignId}/members/${userId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members', campaignId] });
      setError(undefined);
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });

  if (campaign.isError || (campaign.data && !isOwner)) {
    return (
      <PageError
        error={campaign.error ?? undefined}
        onRetry={() => void campaign.refetch()}
      />
    );
  }

  return (
    <CampaignWorkspaceShell campaign={campaign.data}>
      <PageHeader title={t('members.title')} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {members.isLoading || campaign.isLoading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <section
          className="member-section"
          aria-label={t('members.currentMembers')}
        >
          {members.data?.length ? (
            <div className="member-list">
              {members.data.map((member) => (
                <article className="member-row" key={member.memberId}>
                  <div className="member-identity">
                    <Avatar
                      alt={member.user.name || member.user.email}
                      imageUrl={member.user.avatarUrl}
                      seed={member.user.userId}
                      size="small"
                    />
                    <div>
                      <strong>{member.user.name || member.user.email}</strong>
                      {member.user.name && <p>{member.user.email}</p>}
                    </div>
                  </div>
                  {member.campaignRole === 'OWNER' ? (
                    // The master is listed but cannot be managed here.
                    <p className="role-badge">{t('workspace.roles.OWNER')}</p>
                  ) : (
                    <div className="action-row">
                      <select
                        aria-label={t('members.roleFor', {
                          name: member.user.name || member.user.email,
                        })}
                        defaultValue={member.campaignRole}
                        onChange={(event) =>
                          updateMember.mutate({
                            userId: member.user.userId,
                            role: event.target.value,
                          })
                        }
                      >
                        {assignableRoles.map((role) => (
                          <option key={role} value={role}>
                            {t(`workspace.roles.${role}`)}
                          </option>
                        ))}
                      </select>
                      <button
                        className="button-danger"
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              t('members.removeConfirmation', {
                                name: member.user.name || member.user.email,
                              }),
                            )
                          )
                            removeMember.mutate(member.user.userId);
                        }}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : null}
          {!members.data?.some((member) => member.campaignRole !== 'OWNER') && (
            <p className="muted">{t('members.empty')}</p>
          )}
        </section>
      )}
    </CampaignWorkspaceShell>
  );
}
