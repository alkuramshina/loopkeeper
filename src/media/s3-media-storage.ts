import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Readable } from 'node:stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import s3Config from '../config/s3.config';
import {
  MediaStorage,
  MediaObjectNotFound,
  normalizeKeyPrefix,
  validateStorageKey,
} from './media-storage';

export const S3_OPERATION_TIMEOUT_MS = 30_000;
export const S3_READINESS_TIMEOUT_MS = 2_000;

function missingObject(error: unknown): boolean {
  // A generic 404 could also mean the bucket is missing. Only object-specific
  // errors are absence; configuration and authorization failures must propagate.
  return (
    error instanceof Error && ['NoSuchKey', 'NotFound'].includes(error.name)
  );
}

@Injectable()
export class S3MediaStorage extends MediaStorage implements OnModuleDestroy {
  readonly client: S3Client;
  private readonly prefix: string;

  constructor(
    @Inject(s3Config.KEY) private readonly config: ConfigType<typeof s3Config>,
  ) {
    super();
    this.prefix = normalizeKeyPrefix(config.keyPrefix);
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle,
      maxAttempts: 2,
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 2_000,
        requestTimeout: 10_000,
        throwOnRequestTimeout: true,
      }),
      // MinIO supports ordinary signed PutObject requests with a known length.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  onModuleDestroy() {
    this.client.destroy();
  }

  private key(key: string): string {
    validateStorageKey(key);
    return this.prefix + key;
  }

  async put(
    key: string,
    body: Buffer | Readable,
    byteSize: number,
  ): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: this.key(key),
          Body: body,
          ContentLength: byteSize,
          ContentType: 'image/webp',
        }),
        { abortSignal: AbortSignal.timeout(S3_OPERATION_TIMEOUT_MS) },
      );
    } finally {
      if (body instanceof Readable) body.destroy();
    }
  }

  async get(key: string) {
    const abort = new AbortController();
    let activeBody: Readable | undefined;
    const timer = setTimeout(() => {
      abort.abort();
      activeBody?.destroy(new Error('Media storage read timed out'));
    }, S3_OPERATION_TIMEOUT_MS);
    timer.unref();
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: this.key(key),
        }),
        { abortSignal: abort.signal },
      );
      if (
        !(result.Body instanceof Readable) ||
        result.ContentLength === undefined
      ) {
        await result.Body?.transformToWebStream().cancel();
        throw new Error('Invalid media storage response');
      }
      const body = result.Body;
      activeBody = body;
      body.once('close', () => {
        clearTimeout(timer);
        abort.abort();
      });
      body.once('end', () => clearTimeout(timer));
      return {
        body,
        byteSize: result.ContentLength,
        contentType: result.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      clearTimeout(timer);
      if (missingObject(error)) throw new MediaObjectNotFound();
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: this.key(key),
      }),
      { abortSignal: AbortSignal.timeout(S3_OPERATION_TIMEOUT_MS) },
    );
  }

  async list(cursor?: string, pageSize = 1000) {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
      throw new Error('Invalid media listing page size');
    }
    const result = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: this.prefix,
        ContinuationToken: cursor,
        MaxKeys: pageSize,
      }),
      { abortSignal: AbortSignal.timeout(S3_OPERATION_TIMEOUT_MS) },
    );
    const objects = (result.Contents ?? []).map((item) => {
      if (!item.Key?.startsWith(this.prefix) || !item.LastModified)
        throw new Error('Invalid media storage listing');
      const key = item.Key.slice(this.prefix.length);
      validateStorageKey(key);
      return { key, modifiedAt: item.LastModified };
    });
    if (result.IsTruncated && !result.NextContinuationToken)
      throw new Error('Invalid media storage cursor');
    return {
      objects,
      cursor: result.IsTruncated ? result.NextContinuationToken : undefined,
    };
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: this.key(key),
        }),
        { abortSignal: AbortSignal.timeout(S3_OPERATION_TIMEOUT_MS) },
      );
      return true;
    } catch (error) {
      if (missingObject(error)) {
        // HeadObject cannot distinguish a missing bucket from a missing key.
        // Confirm bucket access before classifying this as object absence.
        await this.ready();
        return false;
      }
      throw error;
    }
  }

  async ready(): Promise<void> {
    await this.client.send(
      new HeadBucketCommand({ Bucket: this.config.bucket }),
      { abortSignal: AbortSignal.timeout(S3_READINESS_TIMEOUT_MS) },
    );
  }
}
