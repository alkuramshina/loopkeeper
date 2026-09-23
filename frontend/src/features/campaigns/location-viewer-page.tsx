import { PointerEvent, WheelEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Campaign, Location } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { CampaignWorkspaceShell } from './campaign-workspace-shell';

const minimumZoom = 0.5;
const maximumZoom = 3;

function clampZoom(value: number) {
  return Math.min(maximumZoom, Math.max(minimumZoom, value));
}

export function LocationViewerPage() {
  const { campaignId, locationId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>();
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.request<Campaign>(`/campaigns/${campaignId}`),
    enabled: Boolean(campaignId),
    retry: false,
  });
  const location = useQuery({
    queryKey: ['location', locationId],
    queryFn: () => api.request<Location>(`/locations/${locationId}`),
    enabled: Boolean(locationId),
    retry: false,
  });

  if (campaign.isError || location.isError) {
    return <main className="page-state" role="alert">{t('errors.resource.not_found')}</main>;
  }

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!location.data?.imageUrl) return;
    event.preventDefault();
    setZoom((current) => clampZoom(current - event.deltaY * 0.001));
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!location.data?.imageUrl) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragStart({ x: event.clientX - offset.x, y: event.clientY - offset.y });
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    setOffset({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y });
  };
  const onPointerUp = () => setDragStart(undefined);
  const openFullscreen = () => {
    void document.querySelector('.location-viewer-canvas')?.requestFullscreen();
  };

  return (
    <CampaignWorkspaceShell campaign={campaign.data}>
      <section className="location-viewer-header">
        <div>
          <Link className="back-link" to={`/campaigns/${campaignId}/locations`}>
            ← {t('locations.backToList')}
          </Link>
          <p className="kicker">{t('workspace.locations')}</p>
          <h2>{location.data?.title ?? '…'}</h2>
        </div>
        {location.data?.imageUrl && (
          <div className="action-row">
            <button className="button-ghost" onClick={resetView} type="button">
              {t('locations.resetView')}
            </button>
            <button className="button-ghost" onClick={openFullscreen} type="button">
              {t('locations.fullscreen')}
            </button>
          </div>
        )}
      </section>
      {location.isLoading || campaign.isLoading ? (
        <p>{t('common.loading')}</p>
      ) : location.data ? (
        <section className="location-viewer-layout">
          {location.data.imageUrl ? (
            <div
              className="location-viewer-canvas"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={onWheel}
            >
              <img
                alt={location.data.title}
                draggable={false}
                src={location.data.imageUrl}
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                }}
              />
            </div>
          ) : (
            <div className="location-viewer-empty">{t('locations.noImage')}</div>
          )}
          <aside className="panel location-viewer-details">
            <h3>{t('locations.description')}</h3>
            <p>{location.data.description || '—'}</p>
            <p className="muted">{t('locations.orderValue', { value: location.data.sortOrder })}</p>
          </aside>
        </section>
      ) : null}
    </CampaignWorkspaceShell>
  );
}
