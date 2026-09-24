import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import {
  ApiError,
  Campaign,
  CampaignInvitation,
  CampaignMember,
  CreatedCampaignInvitation,
} from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { CampaignWorkspaceShell } from './campaign-workspace-shell';
import { Avatar } from '../../components/avatar';
import { ModalDialog } from '../../components/modal-dialog';

const roles = ['PLAYER', 'VIEWER'] as const;

function apiErrorMessage(cause: unknown, t: TFunction) {
  return cause instanceof ApiError
    ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') })
    : t('errors.unexpected');
}

function invitationStatus(
  invitation: CampaignInvitation,
): 'accepted' | 'revoked' | 'expired' | 'active' {
  if (invitation.acceptedAt) return 'accepted';
  if (invitation.revokedAt) return 'revoked';
  if (new Date(invitation.expiresAt) <= new Date()) return 'expired';
  return 'active';
}

export function MembersPage() {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const [createdInvitation, setCreatedInvitation] =
    useState<CreatedCampaignInvitation>();
  const [isCreatingInvitation, setCreatingInvitation] = useState(false);
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.request<Campaign>(`/campaigns/${campaignId}`),
    enabled: Boolean(campaignId),
    retry: false,
  });
  const isOwner = campaign.data?.currentUserRole === 'OWNER';
  const members = useQuery({
    queryKey: ['members', campaignId],
    queryFn: () =>
      api.request<CampaignMember[]>(`/campaigns/${campaignId}/members`),
    enabled: Boolean(campaignId) && isOwner,
    retry: false,
  });
  const invitations = useQuery({
    queryKey: ['invitations', campaignId],
    queryFn: () =>
      api.request<CampaignInvitation[]>(`/campaigns/${campaignId}/invitations`),
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
  const createInvitation = useMutation({
    mutationFn: (role: string) =>
      api.request<CreatedCampaignInvitation>(
        `/campaigns/${campaignId}/invitations`,
        {
          method: 'POST',
          body: JSON.stringify({ role }),
        },
      ),
    onSuccess: (invitation) => {
      setCreatedInvitation(invitation);
      setCreatingInvitation(false);
      setError(undefined);
      void queryClient.invalidateQueries({
        queryKey: ['invitations', campaignId],
      });
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });
  const revokeInvitation = useMutation({
    mutationFn: (invitationId: string) =>
      api.request<void>(
        `/campaigns/${campaignId}/invitations/${invitationId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['invitations', campaignId],
      });
      setError(undefined);
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });

  function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createInvitation.mutate(
      String(new FormData(event.currentTarget).get('role') ?? 'PLAYER'),
    );
  }

  async function copyInvitation() {
    if (!createdInvitation) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/invitations/${createdInvitation.token}`,
      );
    } catch {
      setError(t('members.copyFailed'));
    }
  }

  if (campaign.isError || (campaign.data && !isOwner)) {
    return (
      <main className="page-state" role="alert">
        {t('errors.resource.not_found')}
      </main>
    );
  }

  const data = campaign.data;
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <CampaignWorkspaceShell campaign={data}>
      <section className="page-header">
        <p className="kicker">{t('workspace.members')}</p>
        <h2>{t('members.title')}</h2>
      </section>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {members.isLoading || invitations.isLoading || campaign.isLoading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <div className="members-layout">
          <section className="member-section">
            <div className="section-heading">
              <h2>{t('members.currentMembers')}</h2>
            </div>
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
                        {roles.map((role) => (
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
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">{t('members.empty')}</p>
            )}
          </section>
          <section className="member-section">
            <div className="section-heading">
              <h2>{t('members.invitations')}</h2>
              <button
                type="button"
                onClick={() => {
                  setError(undefined);
                  setCreatedInvitation(undefined);
                  setCreatingInvitation(true);
                }}
              >
                {t('members.createInvitation')}
              </button>
            </div>
            {isCreatingInvitation && (
              <ModalDialog
                onClose={() => setCreatingInvitation(false)}
                title={t('members.createInvitation')}
              >
                <form onSubmit={submitInvitation}>
                  <RoleSelect />
                  <button disabled={createInvitation.isPending}>
                    {t('members.createInvitation')}
                  </button>
                </form>
              </ModalDialog>
            )}
            {createdInvitation && (
              <div className="created-invitation" role="status">
                <p>{t('members.invitationCreated')}</p>
                <code>{`${window.location.origin}/invitations/${createdInvitation.token}`}</code>
                <button
                  className="button-ghost"
                  type="button"
                  onClick={() => void copyInvitation()}
                >
                  {t('members.copyInvitation')}
                </button>
              </div>
            )}
            {invitations.data?.length ? (
              <div className="member-list">
                {invitations.data.map((invitation) => {
                  const status = invitationStatus(invitation);
                  return (
                    <article
                      className="member-row"
                      key={invitation.invitationId}
                    >
                      <div>
                        <strong>
                          {t(`workspace.roles.${invitation.role}`)}
                        </strong>
                        <p>
                          {t('members.expiresAt', {
                            date: dateFormat.format(
                              new Date(invitation.expiresAt),
                            ),
                          })}
                        </p>
                        <small
                          className={`invitation-status invitation-${status}`}
                        >
                          {t(`members.statuses.${status}`)}
                        </small>
                      </div>
                      {status === 'active' && (
                        <button
                          className="button-danger"
                          type="button"
                          onClick={() => {
                            if (window.confirm(t('members.revokeConfirmation')))
                              revokeInvitation.mutate(invitation.invitationId);
                          }}
                        >
                          {t('members.revoke')}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="muted">{t('members.invitationsEmpty')}</p>
            )}
          </section>
        </div>
      )}
    </CampaignWorkspaceShell>
  );
}

function RoleSelect() {
  const { t } = useTranslation();
  return (
    <label>
      {t('members.role')}
      <select name="role" defaultValue="PLAYER">
        {roles.map((role) => (
          <option key={role} value={role}>
            {t(`workspace.roles.${role}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
