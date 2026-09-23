import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, NavLink, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { ApiError, Campaign, Location } from '../../api/client';
import { useAuth } from '../../auth/auth-context';

type LocationDraft = {
  title: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
};

function apiErrorMessage(cause: unknown, t: TFunction) {
  return cause instanceof ApiError
    ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') })
    : t('errors.unexpected');
}

function draftFromLocation(location?: Location): LocationDraft {
  return {
    title: location?.title ?? '',
    description: location?.description ?? '',
    imageUrl: location?.imageUrl ?? '',
    sortOrder: location?.sortOrder ?? 0,
  };
}

export function LocationsPage() {
  const { campaignId } = useParams();
  const { api, profile, signOut } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [draft, setDraft] = useState<LocationDraft>(draftFromLocation());
  const [error, setError] = useState<string>();
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.request<Campaign>(`/campaigns/${campaignId}`),
    enabled: Boolean(campaignId),
    retry: false,
  });
  const canRead =
    campaign.data?.currentUserRole === 'OWNER' ||
    campaign.data?.currentUserRole === 'PLAYER';
  const isOwner = campaign.data?.currentUserRole === 'OWNER';
  const locations = useQuery({
    queryKey: ['locations', campaignId],
    queryFn: () =>
      api.request<Location[]>(`/campaigns/${campaignId}/locations`),
    enabled: Boolean(campaignId) && canRead,
    retry: false,
  });
  const selected = locations.data?.find(
    (location) => location.locationId === selectedId,
  );
  const save = useMutation({
    mutationFn: () =>
      selected
        ? api.request<Location>(`/locations/${selected.locationId}`, {
            method: 'PATCH',
            body: JSON.stringify(draft),
          })
        : api.request<Location>(`/campaigns/${campaignId}/locations`, {
            method: 'POST',
            body: JSON.stringify(draft),
          }),
    onSuccess: (location) => {
      setSelectedId(location.locationId);
      setDraft(draftFromLocation(location));
      setError(undefined);
      void queryClient.invalidateQueries({
        queryKey: ['locations', campaignId],
      });
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });
  const remove = useMutation({
    mutationFn: () =>
      api.request<void>(`/locations/${selectedId}`, { method: 'DELETE' }),
    onSuccess: () => {
      setSelectedId(undefined);
      setDraft(draftFromLocation());
      setError(undefined);
      void queryClient.invalidateQueries({
        queryKey: ['locations', campaignId],
      });
    },
    onError: (cause) => setError(apiErrorMessage(cause, t)),
  });

  function selectLocation(location: Location) {
    setSelectedId(location.locationId);
    setDraft(draftFromLocation(location));
    setError(undefined);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate();
  }

  if (campaign.isError || (campaign.data && !canRead))
    return (
      <main className="page-state" role="alert">
        {t('errors.resource.not_found')}
      </main>
    );

  const basePath = `/campaigns/${campaignId}`;
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
          <p className="kicker">
            {campaign.data
              ? t(`workspace.roles.${campaign.data.currentUserRole}`)
              : '…'}
          </p>
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
        {isOwner && (
          <>
            <NavLink to={`${basePath}/members`}>
              {t('workspace.members')}
            </NavLink>
            <NavLink to={`${basePath}/settings/backgrounds`}>
              {t('workspace.backgroundSettings')}
            </NavLink>
          </>
        )}
      </nav>
      <section className="page-header">
        <p className="kicker">{t('workspace.locations')}</p>
        <h2>{t('locations.title')}</h2>
      </section>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {campaign.isLoading || locations.isLoading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <div className="locations-layout">
          <section className="location-list" aria-label={t('locations.title')}>
            {locations.data?.length ? (
              locations.data
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((location) => (
                  <button
                    type="button"
                    className={`location-list-item ${selectedId === location.locationId ? 'selected' : ''}`}
                    key={location.locationId}
                    onClick={() => selectLocation(location)}
                  >
                    <strong>{location.title}</strong>
                    <small>
                      {t('locations.orderValue', { value: location.sortOrder })}
                    </small>
                  </button>
                ))
            ) : (
              <p className="empty-state">{t('locations.empty')}</p>
            )}
          </section>
          <section className="panel location-detail">
            {isOwner ? (
              <form onSubmit={submit}>
                <div className="section-heading">
                  <h2>{selected ? t('locations.edit') : t('locations.new')}</h2>
                  {selected && (
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() => {
                        setSelectedId(undefined);
                        setDraft(draftFromLocation());
                      }}
                    >
                      {t('locations.new')}
                    </button>
                  )}
                </div>
                <label>
                  {t('locations.name')}
                  <input
                    value={draft.title}
                    required
                    maxLength={200}
                    onChange={(event) =>
                      setDraft({ ...draft, title: event.target.value })
                    }
                  />
                </label>
                <label>
                  {t('locations.description')}
                  <textarea
                    value={draft.description}
                    maxLength={10000}
                    onChange={(event) =>
                      setDraft({ ...draft, description: event.target.value })
                    }
                  />
                </label>
                <label>
                  {t('locations.imageUrl')}
                  <input
                    type="url"
                    value={draft.imageUrl}
                    maxLength={2048}
                    pattern="https://.*"
                    placeholder="https://"
                    onChange={(event) =>
                      setDraft({ ...draft, imageUrl: event.target.value })
                    }
                  />
                </label>
                <label>
                  {t('locations.order')}
                  <input
                    type="number"
                    min={0}
                    value={draft.sortOrder}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        sortOrder: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <button disabled={save.isPending}>{t('common.save')}</button>
                {selected && (
                  <button
                    type="button"
                    className="button-danger"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          t('locations.deleteConfirmation', {
                            title: selected.title,
                          }),
                        )
                      )
                        remove.mutate();
                    }}
                  >
                    {t('common.delete')}
                  </button>
                )}
              </form>
            ) : selected ? (
              <LocationView location={selected} />
            ) : (
              <p className="muted">{t('locations.select')}</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function LocationView({ location }: { location: Location }) {
  const { t } = useTranslation();
  return (
    <>
      <h2>{location.title}</h2>
      {location.imageUrl && (
        <img className="location-image" src={location.imageUrl} alt="" />
      )}
      <p>{location.description || '—'}</p>
      <p className="muted">
        {t('locations.orderValue', { value: location.sortOrder })}
      </p>
    </>
  );
}
