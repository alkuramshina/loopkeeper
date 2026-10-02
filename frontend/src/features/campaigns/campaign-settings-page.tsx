import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Campaign } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { MediaUpload } from '../../components/media-upload';
import { ProtectedImage } from '../../components/protected-image';
import { PageError } from '../../components/page-error';
import { PageHeader } from '../../components/page-header';
import { ModalDialog } from '../../components/modal-dialog';
import { Button } from '../../components/ui/button';
import { apiErrorMessage, useOwnerCampaign } from './members-shared';
import '../account/account.css';
import './workspace-settings.css';

/** One screen of the campaign settings: the master's only, a single card. */
function CampaignSettingsScreen({
  title,
  campaign,
  children,
}: {
  title: string;
  campaign: ReturnType<typeof useOwnerCampaign>['campaign'];
  children: (campaign: Campaign) => ReactNode;
}) {
  const { t } = useTranslation();
  const isOwner = campaign.data?.currentUserRole === 'OWNER';

  if (campaign.isError || (campaign.data && !isOwner)) {
    return (
      <PageError
        inline
        error={campaign.error ?? undefined}
        onRetry={() => void campaign.refetch()}
      />
    );
  }

  return (
    <>
      <PageHeader title={title} />
      {campaign.data ? children(campaign.data) : <p>{t('common.loading')}</p>}
    </>
  );
}

export function CampaignSettingsPage() {
  const { campaignId, campaign } = useOwnerCampaign();
  const { api } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const update = useMutation({
    mutationFn: (form: FormData) =>
      api.request<Campaign>(`/campaigns/${campaignId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: form.get('title'),
          description: form.get('description'),
        }),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<Campaign>(['campaign', campaignId], updated);
      queryClient.setQueryData<Campaign[]>(['campaigns'], (campaigns) =>
        campaigns?.map((item) =>
          item.campaignId === updated.campaignId ? updated : item,
        ),
      );
      setError(undefined);
      setSaved(true);
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });

  useEffect(() => {
    setSaved(false);
  }, [campaignId]);

  return (
    <CampaignSettingsScreen
      campaign={campaign}
      title={t('campaignSettings.details')}
    >
      {(data) => (
        <form
          className="account-card campaign-settings-card"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            // Read the form now: the mutation runs after the event is released.
            event.preventDefault();
            setSaved(false);
            update.mutate(new FormData(event.currentTarget));
          }}
        >
          <div className="account-card-section account-fields">
            <div className="account-field">
              <label htmlFor="campaign-title">
                {t('campaigns.campaignTitle')}
              </label>
              <input
                id="campaign-title"
                defaultValue={data.title}
                maxLength={100}
                name="title"
                required
              />
            </div>
            <div className="account-field">
              <label htmlFor="campaign-description">
                {t('campaigns.description')}
              </label>
              <textarea
                id="campaign-description"
                defaultValue={data.description ?? ''}
                maxLength={1000}
                name="description"
              />
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <footer className="account-card-footer">
            {saved && (
              <span className="account-saved" role="status">
                {t('campaignSettings.saved')}
              </span>
            )}
            <Button disabled={update.isPending} type="submit" variant="primary">
              {t('common.save')}
            </Button>
          </footer>
        </form>
      )}
    </CampaignSettingsScreen>
  );
}

export function CampaignCoverPage() {
  const { campaignId, campaign } = useOwnerCampaign();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return (
    <CampaignSettingsScreen
      campaign={campaign}
      title={t('campaignSettings.cover')}
    >
      {(data) => (
        <section className="account-card campaign-settings-card">
          <div className="account-card-section">
            {data.coverUrl && (
              <ProtectedImage
                alt={data.title}
                className="campaign-cover-preview"
                imageUrl={data.coverUrl}
              />
            )}
            <MediaUpload
              endpoint={`/campaigns/${campaignId}/cover`}
              hasImage={Boolean(data.coverUrl?.startsWith('/media/'))}
              label={t('campaignSettings.cover')}
              onChanged={async () => {
                await Promise.all([
                  queryClient.invalidateQueries({
                    queryKey: ['campaign', campaignId],
                  }),
                  queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
                ]);
              }}
            />
          </div>
        </section>
      )}
    </CampaignSettingsScreen>
  );
}

export function CampaignDeletePage() {
  const { campaignId, campaign } = useOwnerCampaign();
  const { api } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useMutation({
    mutationFn: () =>
      api.request<void>(`/campaigns/${campaignId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.removeQueries({ queryKey: ['campaign', campaignId] });
      void navigate('/campaigns', { replace: true });
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });

  return (
    <CampaignSettingsScreen
      campaign={campaign}
      title={t('campaignSettings.dangerTitle')}
    >
      {(data) => (
        <>
          <section className="account-card campaign-settings-card settings-danger-zone">
            <div className="account-card-section">
              <p>{t('campaignSettings.dangerDescription')}</p>
            </div>
            <footer className="account-card-footer">
              <Button
                disabled={remove.isPending}
                onClick={() => setConfirmDelete(true)}
                type="button"
                variant="danger"
              >
                {t('campaignSettings.delete')}
              </Button>
            </footer>
          </section>
          {confirmDelete && (
            <ModalDialog
              onClose={() => setConfirmDelete(false)}
              title={t('campaignSettings.delete')}
            >
              <div className="access-dialog-body">
                <p className="access-dialog-consequence">
                  {t('campaignSettings.deleteConfirmation', {
                    title: data.title,
                  })}
                </p>
              </div>
              {error && (
                <p className="form-error access-dialog-error" role="alert">
                  {error}
                </p>
              )}
              <div className="access-dialog-actions">
                <Button onClick={() => setConfirmDelete(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  disabled={remove.isPending}
                  onClick={() => remove.mutate()}
                  variant="danger"
                >
                  {t('campaignSettings.delete')}
                </Button>
              </div>
            </ModalDialog>
          )}
        </>
      )}
    </CampaignSettingsScreen>
  );
}
