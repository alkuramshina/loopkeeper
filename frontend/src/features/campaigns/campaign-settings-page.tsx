import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { ApiError, Campaign } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { CampaignWorkspaceShell } from './campaign-workspace-shell';
import { MediaUpload } from '../../components/media-upload';
import { ProtectedImage } from '../../components/protected-image';

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
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.request<Campaign>(`/campaigns/${campaignId}`),
    enabled: Boolean(campaignId),
    retry: false,
  });
  const isOwner = campaign.data?.currentUserRole === 'OWNER';
  const update = useMutation({
    mutationFn: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      return api.request<Campaign>(`/campaigns/${campaignId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: form.get('title'),
          description: form.get('description'),
        }),
      });
    },
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
      navigate('/campaigns', { replace: true });
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });

  useEffect(() => {
    setSaved(false);
  }, [campaignId]);

  if (campaign.isError || (campaign.data && !isOwner)) {
    return (
      <main className="page-state" role="alert">
        {t('errors.resource.not_found')}
      </main>
    );
  }

  return (
    <CampaignWorkspaceShell campaign={campaign.data}>
      <section className="page-header">
        <p className="kicker">{t('workspace.campaignSettings')}</p>
        <h2>{t('campaignSettings.title')}</h2>
      </section>
      {campaign.isLoading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <div className="settings-grid">
          <form className="panel" onSubmit={(event) => update.mutate(event)}>
            <div className="section-heading">
              <h2>{t('campaignSettings.details')}</h2>
              {saved && (
                <small className="success-message">
                  {t('campaignSettings.saved')}
                </small>
              )}
            </div>
            <label>
              {t('campaigns.campaignTitle')}
              <input
                defaultValue={campaign.data?.title}
                maxLength={100}
                name="title"
                required
              />
            </label>
            <label>
              {t('campaigns.description')}
              <textarea
                defaultValue={campaign.data?.description ?? ''}
                maxLength={1000}
                name="description"
                required
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button disabled={update.isPending}>{t('common.save')}</button>
          </form>
          <section className="panel">
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
                  queryClient.invalidateQueries({
                    queryKey: ['campaign', campaignId],
                  }),
                  queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
                ]);
              }}
            />
          </section>
          <section className="panel">
            <h2>{t('backgrounds.title')}</h2>
            <p>{t('campaignSettings.backgroundsDescription')}</p>
            <Link
              className="button-link"
              to={`/campaigns/${campaignId}/settings/backgrounds`}
            >
              {t('workspace.backgroundSettings')}
            </Link>
          </section>
          <section className="panel settings-danger-zone">
            <h2>{t('campaignSettings.dangerTitle')}</h2>
            <p>{t('campaignSettings.dangerDescription')}</p>
            <button
              className="button-danger"
              disabled={remove.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    t('campaignSettings.deleteConfirmation', {
                      title: campaign.data?.title,
                    }),
                  )
                ) {
                  remove.mutate();
                }
              }}
              type="button"
            >
              {t('campaignSettings.delete')}
            </button>
          </section>
        </div>
      )}
    </CampaignWorkspaceShell>
  );
}
