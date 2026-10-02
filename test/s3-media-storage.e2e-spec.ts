import { Readable } from 'node:stream';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import sharp from 'sharp';
import { MediaStorage, MediaObjectNotFound } from '../src/media/media-storage';
import { PrismaService } from '../src/prisma/prisma.service';
import { MediaService } from '../src/media/media.service';
import { S3MediaStorage } from '../src/media/s3-media-storage';
import { createTestApp } from './helpers/app';
import {
  closeTestDatabase,
  getTestPrisma,
  resetTestDatabase,
} from './helpers/database';
import {
  testMediaStorage,
  assertTestMediaScope,
} from './helpers/media-storage';

jest.setTimeout(30_000);

describe('S3 media integration', () => {
  let app: INestApplication;
  let storage: S3MediaStorage;
  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
    storage = testMediaStorage();
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    storage.onModuleDestroy();
    await app.close();
  });
  afterAll(async () => closeTestDatabase());

  const image = () =>
    sharp({
      create: { width: 512, height: 512, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
  it('reconciles real objects in report/apply modes and keeps fresh objects and neighboring scopes', async () => {
    await storage.put('orphan.webp', Buffer.from('orphan'), 6);
    const service = app.get(MediaService);
    const graceMs = 3_600_000;
    expect(
      (await service.reconcile({ apply: true, graceMs })).deletedObjects,
    ).toBe(0);
    // Move the reconciliation clock past the grace period without changing
    // S3 signing timestamps or sleeping for an hour.
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + 7_200_000);
    const report = await service.reconcile({ apply: false, graceMs });
    expect(report.orphanFiles).toBeGreaterThanOrEqual(1);
    expect(await storage.exists('orphan.webp')).toBe(true);
    expect(
      (await service.reconcile({ apply: true, graceMs })).deletedObjects,
    ).toBe(1);
    expect(await storage.exists('orphan.webp')).toBe(false);
    expect(
      (await service.reconcile({ apply: true, graceMs })).deletedObjects,
    ).toBe(0);
  });
  async function user(email: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'test-password-123', name: email })
      .expect(201);
    return { Authorization: `Bearer ${response.body.accessToken}` };
  }

  it('round-trips buffers and streams, paginates within its exact scope and deletes idempotently', async () => {
    await storage.put('a.webp', Buffer.from('one'), 3);
    await storage.put('b.webp', Readable.from(Buffer.from('two')), 3);
    await storage.put('c.webp', Buffer.from('three'), 5);
    const neighbor = new S3MediaStorage({
      endpoint: 'http://localhost:9002',
      region: 'us-east-1',
      bucket: 'loopkeeper-test',
      accessKeyId: 'loopkeeper-test-app',
      secretAccessKey: 'loopkeeper-test-app-secret',
      forcePathStyle: true,
      keyPrefix: process.env.S3_KEY_PREFIX + '-neighbor',
    });
    try {
      await neighbor.put('neighbor.webp', Buffer.from('safe'), 4);
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await storage.list(cursor, 1);
        keys.push(...page.objects.map((object) => object.key));
        cursor = page.cursor;
      } while (cursor);
      expect(keys).toEqual(['a.webp', 'b.webp', 'c.webp']);
      const object = await storage.get('b.webp');
      const chunks: Buffer[] = [];
      for await (const chunk of object.body) chunks.push(chunk as Buffer);
      expect(Buffer.concat(chunks).toString()).toBe('two');
      expect(object).toMatchObject({ byteSize: 3, contentType: 'image/webp' });
      expect(await storage.exists('a.webp')).toBe(true);
      await storage.delete('a.webp');
      await storage.delete('a.webp');
      expect(await storage.exists('a.webp')).toBe(false);
      await expect(storage.get('a.webp')).rejects.toBeInstanceOf(
        MediaObjectNotFound,
      );
      expect(await neighbor.exists('neighbor.webp')).toBe(true);
      await storage.ready();
      const anonymous = await fetch(
        'http://localhost:9002/loopkeeper-test/' +
          process.env.S3_KEY_PREFIX +
          '/b.webp',
      );
      expect(anonymous.status).toBe(403);
    } finally {
      await neighbor.delete('neighbor.webp');
      neighbor.onModuleDestroy();
    }
  });

  it('preserves the previous avatar on failed writes and failed database commits', async () => {
    const owner = await user('s3-owner@loopkeeper.dev');
    const source = await image();
    const first = await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set(owner)
      .attach('file', source, 'avatar.png')
      .expect(201);
    const driver = app.get(MediaStorage);
    jest
      .spyOn(driver, 'put')
      .mockRejectedValueOnce(new Error('secret endpoint credentials'));
    await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set(owner)
      .attach('file', source, 'avatar.png')
      .expect(503)
      .expect((response) =>
        expect(response.body.code).toBe('media.storage_unavailable'),
      );
    const before = (await storage.list()).objects.map((object) => object.key);
    jest
      .spyOn(app.get(PrismaService), '$transaction')
      .mockRejectedValueOnce(new Error('Database failure'));
    await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set(owner)
      .attach('file', source, 'avatar.png')
      .expect(500);
    expect((await storage.list()).objects.map((object) => object.key)).toEqual(
      before,
    );
    await request(app.getHttpServer())
      .get(first.body.avatarUrl)
      .set(owner)
      .expect(200);
    expect(await getTestPrisma().mediaAsset.count()).toBe(1);
  });

  it('keeps successful replacements and deletions successful when post-commit cleanup fails', async () => {
    const owner = await user('s3-cleanup@loopkeeper.dev');
    const source = await image();
    const first = await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set(owner)
      .attach('file', source, 'avatar.png')
      .expect(201);
    const driver = app.get(MediaStorage);
    jest
      .spyOn(driver, 'delete')
      .mockRejectedValueOnce(new Error('S3 unavailable'));
    const second = await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set(owner)
      .attach('file', source, 'avatar.png')
      .expect(201);
    await request(app.getHttpServer())
      .get(first.body.avatarUrl)
      .set(owner)
      .expect(404);
    await request(app.getHttpServer())
      .get(second.body.avatarUrl)
      .set(owner)
      .expect(200);
    jest
      .spyOn(driver, 'delete')
      .mockRejectedValueOnce(new Error('S3 unavailable'));
    await request(app.getHttpServer())
      .delete('/users/me/avatar')
      .set(owner)
      .expect(204);
    expect(await getTestPrisma().mediaAsset.count()).toBe(0);
  });

  it('uses current database access before unavailable storage and keeps liveness independent', async () => {
    const owner = await user('s3-access-owner@loopkeeper.dev');
    const player = await user('s3-access-player@loopkeeper.dev');
    const outsider = await user('s3-access-outsider@loopkeeper.dev');
    const campaign = await request(app.getHttpServer())
      .post('/campaigns')
      .set(owner)
      .send({ title: 'S3 access' })
      .expect(201);
    const invitation = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.body.campaignId}/invitations`)
      .set(owner)
      .send({ role: 'PLAYER' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/invitations/${invitation.body.token}/accept`)
      .set(player)
      .expect(201);
    const element = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.body.campaignId}/elements`)
      .set(owner)
      .send({ type: 'OTHER', title: 'Image', access: 'SHARED' })
      .expect(201);
    const cover = await request(app.getHttpServer())
      .post(`/elements/${element.body.elementId}/cover`)
      .set(owner)
      .attach('file', await image(), 'cover.png')
      .expect(201);
    const driver = app.get(MediaStorage);
    const unavailable = jest
      .spyOn(driver, 'get')
      .mockRejectedValue(new Error('secret endpoint credentials'));
    await request(app.getHttpServer())
      .get(cover.body.coverUrl)
      .set(outsider)
      .expect(404);
    expect(unavailable).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .get(cover.body.coverUrl)
      .set(player)
      .expect(503);
    await request(app.getHttpServer())
      .patch(`/elements/${element.body.elementId}/access`)
      .set(owner)
      .send({ access: 'MASTER_ONLY' })
      .expect(200);
    unavailable.mockClear();
    await request(app.getHttpServer())
      .get(cover.body.coverUrl)
      .set(player)
      .expect(404);
    expect(unavailable).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .patch(`/elements/${element.body.elementId}/access`)
      .set(owner)
      .send({ access: 'SHARED' })
      .expect(200);
    const members = await request(app.getHttpServer())
      .get(`/campaigns/${campaign.body.campaignId}/members`)
      .set(owner)
      .expect(200);
    const playerMember = members.body.find(
      (item: { campaignRole: string }) => item.campaignRole === 'PLAYER',
    );
    await request(app.getHttpServer())
      .delete(
        `/campaigns/${campaign.body.campaignId}/members/${playerMember.user.userId}`,
      )
      .set(owner)
      .expect(200);
    unavailable.mockClear();
    await request(app.getHttpServer())
      .get(cover.body.coverUrl)
      .set(player)
      .expect(404);
    expect(unavailable).not.toHaveBeenCalled();
    jest
      .spyOn(driver, 'ready')
      .mockRejectedValue(new Error('secret endpoint bucket'));
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503)
      .expect((response) => {
        expect(response.body.statusCode).toBe(503);
        expect(response.body.code).toBe('internal.error');
        expect(JSON.stringify(response.body)).not.toContain('secret');
      });
    await request(app.getHttpServer()).get('/health/live').expect(200);
  });

  it('refuses destructive helpers outside the isolated test bucket, endpoint or prefix', () => {
    const original = { ...process.env };
    try {
      for (const [key, value] of [
        ['S3_BUCKET', 'loopkeeper'],
        ['S3_ENDPOINT', 'http://localhost:9000'],
        ['S3_KEY_PREFIX', ''],
        ['S3_KEY_PREFIX', 'tests/../dev'],
      ]) {
        process.env[key] = value;
        expect(() => assertTestMediaScope()).toThrow('Refusing media cleanup');
        process.env = { ...original };
      }
    } finally {
      process.env = original;
    }
  });
});
