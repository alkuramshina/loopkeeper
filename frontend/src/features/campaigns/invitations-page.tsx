import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  CampaignInvitation,
  CreatedCampaignInvitation,
} from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { PageHeader } from '../../components/page-header';
import { Avatar } from '../../components/avatar';
import { ModalDialog } from '../../components/modal-dialog';
import { PageError } from '../../components/page-error';
import { formText } from '../../components/form-text';
import {
  apiErrorMessage,
  assignableRoles,
  useOwnerCampaign,
} from './members-shared';
import './workspace-settings.css';

function invitationLink(token: string) {
  return `${window.location.origin}/invitations/${token}`;
}

function invitationStatus(
  invitation: CampaignInvitation,
): 'accepted' | 'revoked' | 'expired' | 'active' {
  if (invitation.acceptedAt) return 'accepted';
  if (invitation.revokedAt) return 'revoked';
  if (new Date(invitation.expiresAt) <= new Date()) return 'expired';
  return 'active';
}

export function InvitationsPage() {
  const { campaignId, campaign, isOwner } = useOwnerCampaign();
  const { api } = useAuth();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const [createdInvitation, setCreatedInvitation] =
    useState<CreatedCampaignInvitation>();
  const [isCreatingInvitation, setCreatingInvitation] = useState(false);
  // The invitation whose link was just copied, to confirm it on its button.
  const [copiedId, setCopiedId] = useState<string>();
  useEffect(() => {
    if (!copiedId) return;
    const timer = window.setTimeout(() => setCopiedId(undefined), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedId]);
  const invitations = useQuery({
    queryKey: ['invitations', campaignId],
    queryFn: () =>
      api.request<CampaignInvitation[]>(`/campaigns/${campaignId}/invitations`),
    enabled: Boolean(campaignId) && isOwner,
    retry: false,
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
      formText(new FormData(event.currentTarget), 'role') || 'PLAYER',
    );
  }

  async function copyInvitation(invitationId: string, token: string) {
    try {
      await navigator.clipboard.writeText(invitationLink(token));
      setError(undefined);
      setCopiedId(invitationId);
    } catch {
      setError(t('members.copyFailed'));
    }
  }

  if (campaign.isError || (campaign.data && !isOwner)) {
    return (
      <PageError
        inline
        error={campaign.error ?? undefined}
        onRetry={() => void campaign.refetch()}
      />
    );
  }

  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <>
      <PageHeader
        title={t('members.invitations')}
        actions={
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
        }
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
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
      {invitations.isLoading || campaign.isLoading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <section
          className="member-section"
          aria-label={t('members.invitations')}
        >
          {createdInvitation && (
            <div className="created-invitation" role="status">
              <p>{t('members.invitationCreated')}</p>
              <code>{invitationLink(createdInvitation.token)}</code>
              <button
                className="button-ghost"
                type="button"
                onClick={() =>
                  void copyInvitation(
                    createdInvitation.invitationId,
                    createdInvitation.token,
                  )
                }
              >
                {t(
                  copiedId === createdInvitation.invitationId
                    ? 'members.copied'
                    : 'members.copyInvitation',
                )}
              </button>
            </div>
          )}
          {invitations.data?.length ? (
            <div className="member-list">
              {invitations.data.map((invitation) => {
                const status = invitationStatus(invitation);
                const { acceptedBy: acceptor, token } = invitation;
                return (
                  <article className="member-row" key={invitation.invitationId}>
                    <div>
                      <strong>{t(`workspace.roles.${invitation.role}`)}</strong>
                      <p>
                        {invitation.acceptedAt
                          ? t('members.acceptedAt', {
                              date: dateFormat.format(
                                new Date(invitation.acceptedAt),
                              ),
                            })
                          : t('members.expiresAt', {
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
                    {acceptor && (
                      <div className="member-identity invitation-acceptor">
                        <Avatar
                          alt={acceptor.name || acceptor.email}
                          imageUrl={acceptor.avatarUrl}
                          seed={acceptor.userId}
                          size="small"
                        />
                        <div>
                          <small className="muted">
                            {t('members.acceptedBy')}
                          </small>
                          <strong>{acceptor.name || acceptor.email}</strong>
                        </div>
                      </div>
                    )}
                    {status === 'active' && (
                      <div className="action-row">
                        {token && (
                          <button
                            className="button-ghost"
                            type="button"
                            onClick={() =>
                              void copyInvitation(
                                invitation.invitationId,
                                token,
                              )
                            }
                          >
                            {t(
                              copiedId === invitation.invitationId
                                ? 'members.copied'
                                : 'members.copyInvitation',
                            )}
                          </button>
                        )}
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
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="muted">{t('members.invitationsEmpty')}</p>
          )}
        </section>
      )}
    </>
  );
}

function RoleSelect() {
  const { t } = useTranslation();
  return (
    <label>
      {t('members.role')}
      <select name="role" defaultValue="PLAYER">
        {assignableRoles.map((role) => (
          <option key={role} value={role}>
            {t(`workspace.roles.${role}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
