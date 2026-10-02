import type { Readable } from 'node:stream';

export type MediaObject = {
  body: Readable;
  byteSize: number;
  contentType: string;
};

export type MediaPage = {
  objects: { key: string; modifiedAt: Date }[];
  cursor?: string;
};

export class MediaObjectNotFound extends Error {}

export abstract class MediaStorage {
  abstract put(
    key: string,
    body: Buffer | Readable,
    byteSize: number,
  ): Promise<void>;
  abstract get(key: string): Promise<MediaObject>;
  abstract delete(key: string): Promise<void>;
  abstract list(cursor?: string): Promise<MediaPage>;
  abstract exists(key: string): Promise<boolean>;
  abstract ready(): Promise<void>;
}

export function normalizeKeyPrefix(value: string): string {
  if (!value) return '';
  const prefix = value.replace(/\/$/, '');
  if (
    !prefix ||
    !prefix.split('/').every((part) => /^[a-zA-Z0-9_-]+$/.test(part))
  ) {
    throw new Error('Invalid S3 key prefix');
  }
  return `${prefix}/`;
}

export function validateStorageKey(key: string): void {
  if (
    !key ||
    !key
      .split('/')
      .every(
        (part) =>
          /^[a-zA-Z0-9_.-]+$/.test(part) && part !== '.' && part !== '..',
      )
  ) {
    throw new Error('Invalid media storage key');
  }
}
