import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, NavLink, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { ApiError, Campaign, CampaignBackgroundConfig } from '../../api/client';
import { useAuth } from '../../auth/auth-context';

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
  const { api, profile, signOut } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<CampaignBackgroundConfig>();
  const [error, setError] = useState<string>();
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

  const basePath = `/campaigns/${campaignId}`;
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
    <main className="app-page">
      <header className="topbar">
        <Link to="/campaigns">Loopkeeper</Link>
        <span>{profile?.name ?? profile?.email}</span>
        <button className="button-ghost" onClick={() => void signOut()}>
          {t('auth.signOut')}
        </button>
      </header>
      <section className="workspace-heading">
        <Link className="back-link" to={basePath}>
          ← {t('workspace.backToCampaign')}
        </Link>
        <div>
          <p className="kicker">{t('workspace.roles.OWNER')}</p>
          <h1>{campaign.data?.title ?? '…'}</h1>
        </div>
      </section>
      <nav className="workspace-nav" aria-label={t('campaigns.title')}>
        <NavLink end to={basePath}>
          {t('workspace.overview')}
        </NavLink>
        <NavLink to={`${basePath}/board`}>{t('workspace.board')}</NavLink>
        <NavLink to={`${basePath}/characters`}>
          {t('workspace.characters')}
        </NavLink>
        <NavLink to={`${basePath}/notes`}>{t('workspace.notes')}</NavLink>
        <NavLink to={`${basePath}/locations`}>
          {t('workspace.locations')}
        </NavLink>
        <NavLink to={`${basePath}/members`}>{t('workspace.members')}</NavLink>
        <NavLink to={`${basePath}/settings/backgrounds`}>
          {t('workspace.backgroundSettings')}
        </NavLink>
      </nav>
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
              disabled={config.backgrounds.length >= 10}
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
          {config.backgrounds.map((background, index) => (
            <fieldset
              className="background-entry"
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
                  type="url"
                  value={background.imageUrl}
                  placeholder="https://"
                  pattern="https://.*"
                  required
                  onChange={(event) =>
                    updateBackground(index, 'imageUrl', event.target.value)
                  }
                />
              </label>
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
                onClick={() =>
                  setConfig({
                    ...config,
                    fixedBackgroundId:
                      config.fixedBackgroundId === background.backgroundId
                        ? null
                        : config.fixedBackgroundId,
                    backgrounds: config.backgrounds.filter(
                      (_, backgroundIndex) => backgroundIndex !== index,
                    ),
                  })
                }
              >
                {t('common.delete')}
              </button>
            </fieldset>
          ))}
          <button disabled={save.isPending}>{t('common.save')}</button>
        </form>
      )}
    </main>
  );
}
