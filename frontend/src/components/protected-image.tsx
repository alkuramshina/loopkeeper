import { CSSProperties, useEffect, useState } from 'react';
import { useAuth } from '../auth/auth-context';

type ProtectedImageProps = {
  alt: string;
  className?: string;
  imageUrl?: string | null;
  fallback?: string;
  onError?: () => void;
  draggable?: boolean;
  style?: CSSProperties;
};

export function ProtectedImage({
  alt,
  className,
  imageUrl,
  fallback,
  onError,
  draggable,
  style,
}: ProtectedImageProps) {
  const { api } = useAuth();
  const [localImage, setLocalImage] = useState<{
    source: string;
    url: string;
  }>();

  useEffect(() => {
    if (!imageUrl?.startsWith('/media/')) return;
    let active = true;
    let objectUrl: string | undefined;
    void api
      .requestBlob(imageUrl)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setLocalImage({ source: imageUrl, url: objectUrl });
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) {
          setLocalImage(undefined);
          onError?.();
        }
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [api, imageUrl, onError]);

  const src = imageUrl?.startsWith('/media/')
    ? localImage?.source === imageUrl
      ? localImage.url
      : fallback
    : imageUrl || fallback;
  return src ? (
    <img
      alt={alt}
      className={className}
      draggable={draggable}
      onError={onError}
      referrerPolicy="no-referrer"
      src={src}
      style={style}
    />
  ) : null;
}
