import { useEffect, useState } from 'react';
import { createAvatar } from '@dicebear/core';
import {
  create as createInitials,
  meta as initialsMeta,
} from '@dicebear/initials';
import { useAuth } from '../auth/auth-context';

type AvatarProps = {
  alt: string;
  imageUrl?: string | null;
  seed: string;
  size?: 'small' | 'medium' | 'large';
};

export function Avatar({ alt, imageUrl, seed, size = 'medium' }: AvatarProps) {
  const { api } = useAuth();
  const [localImageUrl, setLocalImageUrl] = useState<string>();
  const fallback = createAvatar(
    { create: createInitials, meta: initialsMeta },
    {
      backgroundColor: ['e7edf0', 'dce4d1', 'e9d8d9'],
      radius: 50,
      seed: alt || seed,
    },
  ).toDataUri();

  useEffect(() => {
    if (!imageUrl?.startsWith('/media/')) {
      setLocalImageUrl(undefined);
      return;
    }

    let objectUrl: string | undefined;
    let active = true;
    void api
      .requestBlob(imageUrl)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setLocalImageUrl(objectUrl);
      })
      .catch(() => {
        if (active) setLocalImageUrl(undefined);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [api, imageUrl]);

  return (
    <img
      alt={alt}
      className={`avatar avatar-${size}`}
      referrerPolicy="no-referrer"
      src={
        localImageUrl ||
        (imageUrl?.startsWith('/media/') ? fallback : imageUrl) ||
        fallback
      }
    />
  );
}
