import {
  ListObjectsV2Command,
  S3Client,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

function client() {
  if (
    !/^tests\/browser-[a-f0-9-]+$/.test(
      process.env.LOOPKEEPER_BROWSER_MEDIA_PREFIX ?? '',
    )
  ) {
    throw new Error('Refusing browser media access outside its test run');
  }
  return new S3Client({
    endpoint: 'http://localhost:9002',
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: 'loopkeeper-test-app',
      secretAccessKey: 'loopkeeper-test-app-secret',
    },
  });
}

export async function storedBrowserObjects(): Promise<string[]> {
  const storage = client();
  try {
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await storage.send(
        new ListObjectsV2Command({
          Bucket: 'loopkeeper-test',
          Prefix: process.env.LOOPKEEPER_BROWSER_MEDIA_PREFIX + '/',
          ContinuationToken: cursor,
        }),
      );
      keys.push(...(page.Contents ?? []).map((object) => object.Key!));
      cursor = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (cursor);
    return keys;
  } finally {
    storage.destroy();
  }
}

export default async function cleanupBrowserMedia(): Promise<void> {
  const keys = await storedBrowserObjects();
  const storage = client();
  try {
    for (const key of keys) {
      if (!key.startsWith(process.env.LOOPKEEPER_BROWSER_MEDIA_PREFIX + '/'))
        throw new Error('Invalid browser media key');
      await storage.send(
        new DeleteObjectCommand({ Bucket: 'loopkeeper-test', Key: key }),
      );
    }
  } finally {
    storage.destroy();
  }
}
