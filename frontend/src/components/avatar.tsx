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
      backgroundColor: ['1d6378', 'b5543a', '5f7f2c', '7b4a9c', 'a8325a'],
      textColor: ['ffffff'],
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
