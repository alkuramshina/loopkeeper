import { S3MediaStorage } from '../../src/media/s3-media-storage';

// Never inherit development configuration for a destructive test helper.
export function testMediaStorage(): S3MediaStorage {
  assertTestMediaScope();
  return new S3MediaStorage({
    endpoint: 'http://localhost:9002',
    region: 'us-east-1',
    bucket: 'loopkeeper-test',
    accessKeyId: 'loopkeeper-test-app',
    secretAccessKey: 'loopkeeper-test-app-secret',
    forcePathStyle: true,
    keyPrefix: process.env.S3_KEY_PREFIX!,
  });
}

export function assertTestMediaScope(): void {
  if (
    process.env.S3_ENDPOINT !== 'http://localhost:9002' ||
    process.env.S3_BUCKET !== 'loopkeeper-test' ||
    !/^tests\/[a-zA-Z0-9_-]+$/.test(process.env.S3_KEY_PREFIX ?? '')
  ) {
    throw new Error('Refusing media cleanup outside an isolated test scope');
  }
}

export async function storedTestObjects(): Promise<string[]> {
  const storage = testMediaStorage();
  try {
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await storage.list(cursor);
      keys.push(...page.objects.map((object) => object.key));
      cursor = page.cursor;
    } while (cursor);
    return keys;
  } finally {
    storage.onModuleDestroy();
  }
}

export async function clearTestMedia(): Promise<void> {
  const keys = await storedTestObjects();
  const storage = testMediaStorage();
  try {
    for (const key of keys) await storage.delete(key);
  } finally {
    storage.onModuleDestroy();
  }
}

export async function testObjectExists(key: string): Promise<boolean> {
  const storage = testMediaStorage();
  try {
    return await storage.exists(key);
  } finally {
    storage.onModuleDestroy();
  }
}
