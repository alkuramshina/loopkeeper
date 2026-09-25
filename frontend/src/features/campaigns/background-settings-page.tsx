import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import {
  ApiError,
  Campaign,
  CampaignBackground,
  CampaignBackgroundConfig,
} from '../../api/client';
import { ProtectedImage } from '../../components/protected-image';
import { useAuth } from '../../auth/auth-context';
import { CampaignWorkspaceShell } from './campaign-workspace-shell';

function apiErrorMessage(cause: unknown, t: TFunction) {
  return cause instanceof ApiError
    ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') })
    : t('errors.unexpected');
}

function newBackgroundId() {
  return crypto.randomUUID();
}

export function BackgroundSettingsPage() {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<CampaignBackgroundConfig>();
  const [error, setError] = useState<string>();
  const [pendingBackgroundId, setPendingBackgroundId] = useState<string>();
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.request<Campaign>(`/campaigns/${campaignId}`),
    enabled: Boolean(campaignId),
    retry: false,
  });
  const isOwner = campaign.data?.currentUserRole === 'OWNER';
  const settings = useQuery({
    queryKey: ['background-settings', campaignId],
    queryFn: () =>
      api.request<CampaignBackgroundConfig>(
        `/campaigns/${campaignId}/background-settings`,
      ),
    enabled: Boolean(campaignId) && isOwner,
    retry: false,
  });

  useEffect(() => {
    if (settings.data) setConfig(settings.data);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      api.request<CampaignBackgroundConfig>(
        `/campaigns/${campaignId}/background-settings`,
        {
          method: 'PATCH',
          body: JSON.stringify(config),
        },
      ),
    onSuccess: (saved) => {
      setConfig(saved);
      setError(undefined);
      queryClient.setQueryData<Campaign>(['campaign', campaignId], (current) =>
        current ? { ...current, backgroundConfig: saved } : current,
      );
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });

  if (campaign.isError || (campaign.data && !isOwner)) {
    return (
      <main className="page-state" role="alert">
        {t('errors.resource.not_found')}
      </main>
    );
  }

  async function uploadBackground(file: File) {
    if (!file.size) return;
    setPendingBackgroundId('upload');
    setError(undefined);
    try {
      const body = new FormData();
      body.set('file', file);
      const uploaded = await api.request<CampaignBackground>(
        `/campaigns/${campaignId}/backgrounds`,
        { method: 'POST', body },
      );
      setConfig(
        (current) =>
          current && {
            ...current,
            backgrounds: [...current.backgrounds, uploaded],
          },
      );
      await queryClient.invalidateQueries({
        queryKey: ['campaign', campaignId],
      });
    } catch (cause) {
      setError(apiErrorMessage(cause, t));
    } finally {
      setPendingBackgroundId(undefined);
    }
  }

  async function removeBackground(backgroundId: string, imageUrl: string) {
    setPendingBackgroundId(backgroundId);
    setError(undefined);
    try {
      if (imageUrl === `/media/${backgroundId}`) {
        await api.request<void>(
          `/campaigns/${campaignId}/backgrounds/${backgroundId}`,
          { method: 'DELETE' },
        );
      }
      setConfig(
        (current) =>
          current && {
            ...current,
            fixedBackgroundId:
              current.fixedBackgroundId === backgroundId
                ? null
                : current.fixedBackgroundId,
            backgrounds: current.backgrounds.filter(
              (background) => background.backgroundId !== backgroundId,
            ),
          },
      );
      await queryClient.invalidateQueries({
        queryKey: ['campaign', campaignId],
      });
    } catch (cause) {
      setError(apiErrorMessage(cause, t));
    } finally {
      setPendingBackgroundId(undefined);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate();
  }
  const updateBackground = (
    index: number,
    field: 'name' | 'imageUrl' | 'isEnabled' | 'sortOrder',
    value: string | boolean,
  ) => {
    setConfig(
      (current) =>
        current && {
          ...current,
          backgrounds: current.backgrounds.map((background, backgroundIndex) =>
            backgroundIndex === index
              ? {
                  ...background,
                  [field]: field === 'sortOrder' ? Number(value) : value,
                }
              : background,
          ),
        },
    );
  };

  return (
    <CampaignWorkspaceShell campaign={campaign.data}>
      <section className="page-header">
        <p className="kicker">{t('workspace.backgroundSettings')}</p>
        <h2>{t('backgrounds.title')}</h2>
      </section>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {campaign.isLoading || settings.isLoading || !config ? (
        <p>{t('common.loading')}</p>
      ) : (
        <form className="panel background-settings" onSubmit={submit}>
          <label>
            {t('backgrounds.selectionMode')}
            <select
              value={config.selectionMode}
              onChange={(event) =>
                setConfig({
                  ...config,
                  selectionMode: event.target
                    .value as CampaignBackgroundConfig['selectionMode'],
                })
              }
            >
              <option value="FIXED">{t('backgrounds.modes.FIXED')}</option>
              <option value="RANDOM">{t('backgrounds.modes.RANDOM')}</option>
            </select>
          </label>
          <label>
            {t('backgrounds.fixedBackground')}
            <select
              value={config.fixedBackgroundId ?? ''}
              disabled={config.selectionMode !== 'FIXED'}
              onChange={(event) =>
                setConfig({
                  ...config,
                  fixedBackgroundId: event.target.value || null,
                })
              }
            >
              <option value="">{t('backgrounds.noFixedBackground')}</option>
              {config.backgrounds
                .filter((background) => background.isEnabled)
                .map((background) => (
                  <option
                    key={background.backgroundId}
                    value={background.backgroundId}
                  >
                    {background.name || t('backgrounds.unnamed')}
                  </option>
                ))}
            </select>
          </label>
          <div className="section-heading">
            <h3>{t('backgrounds.list')}</h3>
            <button
              type="button"
              className="button-ghost"
              disabled={
                config.backgrounds.length >= 10 ||
                Boolean(pendingBackgroundId) ||
                save.isPending
              }
              onClick={() =>
                setConfig({
                  ...config,
                  backgrounds: [
                    ...config.backgrounds,
                    {
                      backgroundId: newBackgroundId(),
                      name: '',
                      imageUrl: '',
                      isEnabled: true,
                      sortOrder: config.backgrounds.length,
                    },
                  ],
                })
              }
            >
              {t('backgrounds.add')}
            </button>
          </div>
          <div className="media-upload">
            <label>
              {t('backgrounds.upload')}
              <input
                accept="image/jpeg,image/png,image/webp"
                type="file"
                disabled={
                  config.backgrounds.length >= 10 ||
                  Boolean(pendingBackgroundId) ||
                  save.isPending
                }
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadBackground(file);
                  event.target.value = '';
                }}
              />
            </label>
            {pendingBackgroundId === 'upload' && (
              <span role="status">{t('common.loading')}</span>
            )}
            <p className="muted">{t('media.uploadNotice')}</p>
          </div>
          {config.backgrounds.length > 0 && (
            <div
              className="background-gallery"
              aria-label={t('backgrounds.gallery')}
            >
              {config.backgrounds.map((background, index) => (
                <a
                  href={`#background-${background.backgroundId}`}
                  key={background.backgroundId}
                >
                  <div className="background-gallery-thumb">
                    <ProtectedImage alt="" imageUrl={background.imageUrl} />
                  </div>
                  <span>
                    {background.name ||
                      t('backgrounds.item', { number: index + 1 })}
                  </span>
                </a>
              ))}
            </div>
          )}
          {config.backgrounds.map((background, index) => (
            <fieldset
              className="background-entry"
              id={`background-${background.backgroundId}`}
              key={background.backgroundId}
            >
              <legend>{t('backgrounds.item', { number: index + 1 })}</legend>
              <label>
                {t('backgrounds.name')}
                <input
                  value={background.name}
                  maxLength={100}
                  required
                  onChange={(event) =>
                    updateBackground(index, 'name', event.target.value)
                  }
                />
              </label>
              <label>
                {t('backgrounds.imageUrl')}
                <input
                  type="text"
                  inputMode="url"
                  value={background.imageUrl}
                  placeholder="https://"
                  pattern="(https://.*|/media/.*)"
                  required
                  readOnly={
                    background.imageUrl === `/media/${background.backgroundId}`
                  }
                  onChange={(event) =>
                    updateBackground(index, 'imageUrl', event.target.value)
                  }
                />
              </label>

              {background.imageUrl && (
                <div
                  className="background-preview"
                  aria-label={t('backgrounds.preview')}
                >
                  <ProtectedImage alt="" imageUrl={background.imageUrl} />
                  <div
                    className="background-preview-safe-area"
                    aria-hidden="true"
                  />
                </div>
              )}
              <p className="muted">{t('backgrounds.safeAreaHint')}</p>
              <label>
                {t('backgrounds.order')}
                <input
                  type="number"
                  value={background.sortOrder}
                  onChange={(event) =>
                    updateBackground(index, 'sortOrder', event.target.value)
                  }
                />
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={background.isEnabled}
                  onChange={(event) =>
                    updateBackground(index, 'isEnabled', event.target.checked)
                  }
                />
                {t('backgrounds.enabled')}
              </label>
              <button
                type="button"
                className="button-danger"
                disabled={Boolean(pendingBackgroundId) || save.isPending}
                onClick={() =>
                  void removeBackground(
                    background.backgroundId,
                    background.imageUrl,
                  )
                }
              >
                {t('common.delete')}
              </button>
            </fieldset>
          ))}
          <button disabled={save.isPending || Boolean(pendingBackgroundId)}>
            {t('common.save')}
          </button>
        </form>
      )}
    </CampaignWorkspaceShell>
  );
}
