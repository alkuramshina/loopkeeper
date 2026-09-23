import { useEffect, useMemo, useState } from 'react';
import { CampaignBackground, CampaignBackgroundConfig } from '../../api/client';

function storageKey(campaignId: string) {
  return `loopkeeper:campaign-background:${campaignId}:WORKSPACE`;
}

export function useCampaignBackground(
  campaignId: string | undefined,
  config: CampaignBackgroundConfig | undefined,
  role: 'OWNER' | 'PLAYER' | 'VIEWER' | undefined,
) {
  const enabled = useMemo(
    () => (role === 'OWNER' || role === 'PLAYER' ? config?.backgrounds.filter((background) => background.isEnabled) ?? [] : []),
    [config, role],
  );
  const fixedBackground = enabled.find(
    (background) => background.backgroundId === config?.fixedBackgroundId,
  );
  const [randomBackgroundId, setRandomBackgroundId] = useState<string>();

  useEffect(() => {
    if (!campaignId || config?.selectionMode !== 'RANDOM' || enabled.length === 0) {
      setRandomBackgroundId(undefined);
      return;
    }

    const key = storageKey(campaignId);
    const storedId = sessionStorage.getItem(key);
    const currentId = storedId && enabled.some((background) => background.backgroundId === storedId)
      ? storedId
      : enabled[Math.floor(Math.random() * enabled.length)].backgroundId;

    if (currentId !== storedId) sessionStorage.setItem(key, currentId);
    setRandomBackgroundId(currentId);
  }, [campaignId, config?.selectionMode, enabled]);

  if (role !== 'OWNER' && role !== 'PLAYER') return undefined;
  if (config?.selectionMode === 'FIXED') return fixedBackground;
  return enabled.find((background) => background.backgroundId === randomBackgroundId);
}

export function CampaignBackgroundLayer({ background }: { background: CampaignBackground | undefined }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const isVisible = background && failedUrl !== background.imageUrl;

  useEffect(() => setFailedUrl(undefined), [background?.imageUrl]);

  return (
    <div className="campaign-background-layer" aria-hidden="true">
      {isVisible ? (
        <img
          src={background.imageUrl}
          alt=""
          onError={() => setFailedUrl(background.imageUrl)}
        />
      ) : (
        <div className="campaign-background-fallback" />
      )}
    </div>
  );
}
