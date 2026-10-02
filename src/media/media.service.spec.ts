import { Readable } from 'node:stream';
import sharp from 'sharp';
import { MediaService } from './media.service';
import { MediaStorage, MediaObjectNotFound } from './media-storage';
import { PrismaService } from '../prisma/prisma.service';

describe('MediaService storage failures', () => {
  const image = () =>
    sharp({
      create: { width: 256, height: 256, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
  let storage: jest.Mocked<MediaStorage>;
  let prisma: {
    user: { findFirst: jest.Mock };
    mediaAsset: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let service: MediaService;
  beforeEach(() => {
    storage = {
      put: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      list: jest.fn(),
      exists: jest.fn(),
      ready: jest.fn(),
    };
    prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ userId: 'user' }) },
      mediaAsset: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    service = new MediaService(prisma as unknown as PrismaService, storage);
  });

  it('does not touch storage when access is refused', async () => {
    prisma.mediaAsset.findFirst.mockResolvedValue(null);
    await expect(
      service.getMediaContent('outsider', 'asset'),
    ).rejects.toMatchObject({ status: 404 });
    expect(storage.get).not.toHaveBeenCalled();
  });
  it('maps absence to 404 and storage errors to safe 503', async () => {
    prisma.mediaAsset.findFirst.mockResolvedValue({ storageKey: 'image.webp' });
    storage.get.mockRejectedValueOnce(new MediaObjectNotFound());
    await expect(
      service.getMediaContent('user', 'asset'),
    ).rejects.toMatchObject({ status: 404 });
    storage.get.mockRejectedValueOnce(new Error('secret endpoint credentials'));
    await expect(
      service.getMediaContent('user', 'asset'),
    ).rejects.toMatchObject({
      status: 503,
      response: {
        code: 'media.storage_unavailable',
        message: 'Media storage is temporarily unavailable',
      },
    });
  });
  it('returns a stream without buffering an authorized object', async () => {
    prisma.mediaAsset.findFirst.mockResolvedValue({ storageKey: 'image.webp' });
    const body = Readable.from(Buffer.from('image'));
    storage.get.mockResolvedValue({
      body,
      byteSize: 5,
      contentType: 'image/webp',
    });
    expect((await service.getMediaContent('user', 'asset')).body).toBe(body);
    body.destroy();
  });
  it('fails before the database transaction when put fails', async () => {
    storage.put.mockRejectedValue(new Error('storage failure'));
    await expect(
      service.replaceAvatar('user', { buffer: await image() }),
    ).rejects.toMatchObject({ status: 503 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('preserves the original transaction error when compensation also fails', async () => {
    const original = new Error('database failure');
    prisma.$transaction.mockRejectedValue(original);
    storage.delete.mockRejectedValue(new Error('cleanup failure'));
    await expect(
      service.replaceAvatar('user', { buffer: await image() }),
    ).rejects.toBe(original);
    expect(storage.put).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenCalledTimes(1);
  });
  it('returns success when old object cleanup fails after commit', async () => {
    prisma.$transaction.mockResolvedValue({
      asset: { assetId: 'new' },
      previousStorageKey: 'old.webp',
    });
    storage.delete.mockRejectedValue(new Error('cleanup failure'));
    await expect(
      service.replaceAvatar('user', { buffer: await image() }),
    ).resolves.toEqual({ assetId: 'new', avatarUrl: '/media/new' });
  });
  it('checks every page and rechecks absent rows before removing old objects', async () => {
    const old = new Date(Date.now() - 7_200_000);
    storage.list
      .mockResolvedValueOnce({
        objects: [
          { key: 'old.webp', modifiedAt: old },
          { key: 'fresh.webp', modifiedAt: new Date() },
        ],
        cursor: 'next',
      })
      .mockResolvedValueOnce({
        objects: [{ key: 'attached.webp', modifiedAt: old }],
      });
    prisma.mediaAsset.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ assetId: 'keep' });
    const report = await service.reconcile({ apply: true, graceMs: 3_600_000 });
    expect(storage.list.mock.calls).toEqual([[undefined], ['next']]);
    expect(storage.delete.mock.calls).toEqual([['old.webp']]);
    expect(report.deletedObjects).toBe(1);
  });
  it('keeps objects whose row appears during the final reference check', async () => {
    storage.list.mockResolvedValue({
      objects: [{ key: 'race.webp', modifiedAt: new Date(0) }],
    });
    prisma.mediaAsset.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ assetId: 'new' });
    await service.reconcile({ apply: true, graceMs: 3_600_000 });
    expect(storage.delete).not.toHaveBeenCalled();
  });
  it('only deletes an orphan row object when the conditional row deletion succeeded', async () => {
    prisma.mediaAsset.findMany.mockResolvedValue([
      { assetId: 'race', storageKey: 'race.webp' },
    ]);
    prisma.mediaAsset.deleteMany.mockResolvedValue({ count: 0 });
    storage.list.mockResolvedValue({ objects: [] });
    await service.reconcile({ apply: true, graceMs: 3_600_000 });
    expect(storage.delete).not.toHaveBeenCalled();
  });
  it('reports deletion failures and refuses to treat listing failure as an empty bucket', async () => {
    storage.list.mockResolvedValue({
      objects: [{ key: 'old.webp', modifiedAt: new Date(0) }],
    });
    prisma.mediaAsset.findFirst.mockResolvedValue(null);
    storage.delete.mockRejectedValue(new Error('delete failed'));
    expect(
      (await service.reconcile({ apply: true, graceMs: 3_600_000 })).errors,
    ).toBe(1);
    storage.list.mockRejectedValue(new Error('secret endpoint'));
    await expect(
      service.reconcile({ apply: true, graceMs: 3_600_000 }),
    ).rejects.toThrow('Media reconciliation failed');
  });
});
