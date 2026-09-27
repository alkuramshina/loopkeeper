import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { ApiError, Campaign } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { CampaignWorkspaceShell } from './campaign-workspace-shell';
import { MediaUpload } from '../../components/media-upload';
import { ProtectedImage } from '../../components/protected-image';
import { PageError } from '../../components/page-error';
import { PageHeader } from '../../components/page-header';
import { ModalDialog } from '../../components/modal-dialog';
import { Button } from '../../components/ui/button';
import '../account/account.css';
import './workspace-settings.css';

function apiErrorMessage(cause: unknown, t: TFunction) {
  return cause instanceof ApiError
    ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') })
    : t('errors.unexpected');
}

export function CampaignSettingsPage() {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.request<Campaign>(`/campaigns/${campaignId}`),
    enabled: Boolean(campaignId),
    retry: false,
  });
  const isOwner = campaign.data?.currentUserRole === 'OWNER';
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

  useEffect(() => {
    setSaved(false);
  }, [campaignId]);

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
      <PageHeader title={t('campaignSettings.title')} />
      {campaign.isLoading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <div className="settings-grid">
          <form
            className="account-card campaign-settings-card"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              // Read the form now: the mutation runs after the event is released.
              event.preventDefault();
              update.mutate(new FormData(event.currentTarget));
            }}
          >
            <div className="account-card-section section-heading">
              <h2>{t('campaignSettings.details')}</h2>
              {saved && (
                <small className="success-message">
                  {t('campaignSettings.saved')}
                </small>
              )}
            </div>
            <div className="account-card-section account-fields">
              <div className="account-field">
                <label htmlFor="campaign-title">{t('campaigns.campaignTitle')}</label>
                <input
                  id="campaign-title"
                  defaultValue={campaign.data?.title}
                  maxLength={100}
                  name="title"
                  required
                />
              </div>
              <div className="account-field">
                <label htmlFor="campaign-description">{t('campaigns.description')}</label>
                <textarea
                  id="campaign-description"
                  defaultValue={campaign.data?.description ?? ''}
                  maxLength={1000}
                  name="description"
                />
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
            </div>
            <footer className="account-card-footer">
              <Button disabled={update.isPending} type="submit" variant="primary">
                {t('common.save')}
              </Button>
            </footer>
          </form>
          <section className="account-card campaign-settings-card">
            <div className="account-card-section">
              <h2>{t('campaignSettings.cover')}</h2>
              {campaign.data?.coverUrl && (
                <ProtectedImage
                  alt={campaign.data.title}
                  className="campaign-cover-preview"
                  imageUrl={campaign.data.coverUrl}
                />
              )}
              <MediaUpload
                endpoint={`/campaigns/${campaignId}/cover`}
                hasImage={Boolean(campaign.data?.coverUrl?.startsWith('/media/'))}
                label={t('campaignSettings.cover')}
                onChanged={async () => {
                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] }),
                    queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
                  ]);
                }}
              />
            </div>
          </section>
          <section className="account-card campaign-settings-card settings-danger-zone">
            <div className="account-card-section">
              <h2>{t('campaignSettings.dangerTitle')}</h2>
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
        </div>
      )}
      {confirmDelete && (
        <ModalDialog onClose={() => setConfirmDelete(false)} title={t('campaignSettings.delete')}>
          <p className="access-dialog-consequence">
            {t('campaignSettings.deleteConfirmation', { title: campaign.data?.title })}
          </p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="access-dialog-actions">
            <Button onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
            <Button disabled={remove.isPending} onClick={() => remove.mutate()} variant="danger">
              {t('campaignSettings.delete')}
            </Button>
          </div>
        </ModalDialog>
      )}
    </CampaignWorkspaceShell>
  );
}
