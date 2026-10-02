import { Readable } from 'node:stream';
import {
  S3MediaStorage,
  S3_OPERATION_TIMEOUT_MS,
  S3_READINESS_TIMEOUT_MS,
} from './s3-media-storage';
import {
  MediaObjectNotFound,
  normalizeKeyPrefix,
  validateStorageKey,
} from './media-storage';
import { HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

describe('S3MediaStorage', () => {
  const config = {
    endpoint: 'http://localhost:9002',
    region: 'us-east-1',
    bucket: 'loopkeeper-test',
    accessKeyId: 'app',
    secretAccessKey: 'secret',
    forcePathStyle: true,
    keyPrefix: 'tests/run/',
  };
  let storage: S3MediaStorage;
  let send: jest.SpyInstance;
  beforeEach(() => {
    storage = new S3MediaStorage(config);
    send = jest.spyOn(storage.client, 'send').mockResolvedValue({} as never);
  });
  afterEach(() => storage.onModuleDestroy());

  it('adds the normalized prefix once to every object operation', async () => {
    await storage.put('image.webp', Buffer.from('image'), 5);
    await storage.delete('image.webp');
    await storage.exists('image.webp');
    send.mockResolvedValueOnce({
      Body: Readable.from('image'),
      ContentLength: 5,
      ContentType: 'image/webp',
    });
    const object = await storage.get('image.webp');
    object.body.destroy();
    expect(send.mock.calls.map(([command]) => command.input.Key)).toEqual(
      Array(4).fill('tests/run/image.webp'),
    );
    expect(send.mock.calls[0][0].input).toMatchObject({
      ContentLength: 5,
      ContentType: 'image/webp',
    });
  });
  it('lists only the exact prefix boundary, strips it and preserves pagination', async () => {
    send.mockResolvedValueOnce({
      Contents: [{ Key: 'tests/run/image.webp', LastModified: new Date(0) }],
      IsTruncated: true,
      NextContinuationToken: 'next',
    });
    await expect(storage.list('previous')).resolves.toEqual({
      objects: [{ key: 'image.webp', modifiedAt: new Date(0) }],
      cursor: 'next',
    });
    const command = send.mock.calls[0][0] as ListObjectsV2Command;
    expect(command.input).toMatchObject({
      Prefix: 'tests/run/',
      ContinuationToken: 'previous',
    });
    send.mockResolvedValueOnce({
      Contents: [
        { Key: 'tests/run-other/image.webp', LastModified: new Date() },
      ],
    });
    await expect(storage.list()).rejects.toThrow(
      'Invalid media storage listing',
    );
  });
  it('allows the entire dedicated bucket for an empty prefix', async () => {
    const all = new S3MediaStorage({ ...config, keyPrefix: '' });
    const spy = jest
      .spyOn(all.client, 'send')
      .mockResolvedValue({ Contents: [] } as never);
    await all.list();
    expect(spy.mock.calls[0][0].input).toMatchObject({ Prefix: '' });
    all.onModuleDestroy();
  });
  it('does not classify network, authorization or bucket errors as absent objects', async () => {
    for (const name of ['AccessDenied', 'NoSuchBucket', 'TimeoutError']) {
      send.mockRejectedValueOnce(Object.assign(new Error('failure'), { name }));
      await expect(storage.exists('image.webp')).rejects.toThrow('failure');
    }
    send.mockRejectedValueOnce(
      Object.assign(new Error(), { name: 'NotFound' }),
    );
    await expect(storage.exists('image.webp')).resolves.toBe(false);
    send.mockRejectedValueOnce(
      Object.assign(new Error(), { name: 'NoSuchKey' }),
    );
    await expect(storage.get('image.webp')).rejects.toBeInstanceOf(
      MediaObjectNotFound,
    );
  });
  it('bounds retries, HTTP waits, operations and readiness', async () => {
    expect(await storage.client.config.maxAttempts()).toBe(2);
    expect(S3_OPERATION_TIMEOUT_MS).toBe(30_000);
    expect(S3_READINESS_TIMEOUT_MS).toBe(2_000);
    await storage.ready();
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadBucketCommand);
    expect(send.mock.calls[0][1].abortSignal).toBeInstanceOf(AbortSignal);
  });
  it('reports a missing bucket as an error when HeadObject returns a generic 404', async () => {
    send.mockRejectedValueOnce(
      Object.assign(new Error(), { name: 'NotFound' }),
    );
    send.mockRejectedValueOnce(
      Object.assign(new Error('bucket inaccessible'), { name: 'NotFound' }),
    );
    await expect(storage.exists('image.webp')).rejects.toThrow(
      'bucket inaccessible',
    );
  });
  it('aborts the SDK operation and closes a stalled read after its total timeout', async () => {
    jest.useFakeTimers();
    const body = new Readable({ read() {} });
    body.on('error', () => {});
    send.mockResolvedValueOnce({ Body: body, ContentLength: 5 });
    const object = await storage.get('image.webp');
    const signal = send.mock.calls[0][1].abortSignal as AbortSignal;
    jest.advanceTimersByTime(S3_OPERATION_TIMEOUT_MS);
    expect(signal.aborted).toBe(true);
    expect(body.destroyed).toBe(true);
    object.body.destroy();
    jest.useRealTimers();
  });
  it.each(['../other', '/other', 'a//b', 'a/../b', 'a\\b'])(
    'rejects unsafe relative key %s',
    (key) => {
      expect(() => validateStorageKey(key)).toThrow();
    },
  );
  it('normalizes prefix boundaries and rejects empty path segments', () => {
    expect(normalizeKeyPrefix('tests/run')).toBe('tests/run/');
    expect(normalizeKeyPrefix('tests/run/')).toBe('tests/run/');
    expect(() => normalizeKeyPrefix('tests//')).toThrow();
  });
});
