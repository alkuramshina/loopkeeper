import { createAvatar } from '@dicebear/core';
import {
  create as createInitials,
  meta as initialsMeta,
} from '@dicebear/initials';
import { ProtectedImage } from './protected-image';

type AvatarProps = {
  alt: string;
  imageUrl?: string | null;
  seed: string;
  size?: 'small' | 'medium' | 'large';
};

export function Avatar({ alt, imageUrl, seed, size = 'medium' }: AvatarProps) {
  const fallback = createAvatar(
    { create: createInitials, meta: initialsMeta },
    {
      backgroundColor: ['e7edf0', 'dce4d1', 'e9d8d9'],
      radius: 50,
      seed: alt || seed,
    },
  ).toDataUri();

  return (
    <ProtectedImage
      alt={alt}
      className={`avatar avatar-${size}`}
      fallback={fallback}
      imageUrl={imageUrl}
    />
  );
}
