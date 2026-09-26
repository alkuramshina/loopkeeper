import { PointerEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProtectedImage } from '../../components/protected-image';

const minimumZoom = 0.5;
const maximumZoom = 3;
const clampZoom = (value: number) =>
  Math.min(maximumZoom, Math.max(minimumZoom, value));

export function ElementMapViewer({
  imageUrl,
  title,
}: {
  imageUrl: string;
  title: string;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((current) => clampZoom(current - event.deltaY * 0.001));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button'))
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX - offset.x,
      y: event.clientY - offset.y,
    };
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    setOffset({
      x: event.clientX - drag.current.x,
      y: event.clientY - drag.current.y,
    });
  }
  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }
  function resetView() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  return (
    <section className="element-map-viewer" aria-label={t('elements.openMap')}>
      <div
        className="location-viewer-canvas element-map-canvas"
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <ProtectedImage
          imageUrl={imageUrl}
          alt={title}
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          }}
        />
        <div className="element-map-controls">
          <button
            type="button"
            className="button-ghost"
            aria-label={t('locations.zoomIn', { defaultValue: 'Zoom in' })}
            onClick={() => setZoom((current) => clampZoom(current + 0.25))}
          >
            +
          </button>
          <button
            type="button"
            className="button-ghost"
            aria-label={t('locations.zoomOut', { defaultValue: 'Zoom out' })}
            onClick={() => setZoom((current) => clampZoom(current - 0.25))}
          >
            −
          </button>
          <button type="button" className="button-ghost" onClick={resetView}>
            {t('locations.resetView')}
          </button>
          <button
            type="button"
            className="button-ghost"
            onClick={() => void canvasRef.current?.requestFullscreen?.()}
          >
            {t('locations.fullscreen')}
          </button>
        </div>
      </div>
    </section>
  );
}
