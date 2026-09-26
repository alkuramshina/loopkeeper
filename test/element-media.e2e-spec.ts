import { randomUUID } from 'node:crypto';
import { access, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import sharp from 'sharp';
import { MediaService } from '../src/media/media.service';
import { MEDIA_UPLOAD_TEMP_PATH } from '../src/media/temporary-file-storage';
import { createTestApp } from './helpers/app';
import {
  closeTestDatabase,
  getTestPrisma,
  resetTestDatabase,
} from './helpers/database';

const password = 'test-password-123';
const mediaStoragePath = 'data/test-media';

type Headers = { Authorization: string };

function createImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 90, g: 60, b: 30 } },
  })
    .png()
    .toBuffer();
}

async function storedFiles(): Promise<string[]> {
  return readdir(mediaStoragePath).catch(() => []);
}

async function pendingUploads(): Promise<string[]> {
  return readdir(MEDIA_UPLOAD_TEMP_PATH).catch(() => []);
}

// Five registrations (Argon2) plus large image processing per test.
jest.setTimeout(30_000);

describe('Element media (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    await rm(mediaStoragePath, { recursive: true, force: true });
    await resetTestDatabase();
    app = await createTestApp();
  });
  afterEach(async () => app.close());
  afterAll(async () => {
    await rm(mediaStoragePath, { recursive: true, force: true });
    await closeTestDatabase();
  });

  async function register(email: string): Promise<Headers> {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: email })
      .expect(201);
    return { Authorization: `Bearer ${response.body.accessToken}` };
  }

  async function setupCampaign() {
    const owner = await register('owner@loopkeeper.dev');
    const player = await register('player@loopkeeper.dev');
    const otherPlayer = await register('other-player@loopkeeper.dev');
    const viewer = await register('viewer@loopkeeper.dev');
    const outsider = await register('outsider@loopkeeper.dev');
    const campaign = await request(app.getHttpServer())
      .post('/campaigns')
      .set(owner)
      .send({ title: 'Mystery', description: 'A campaign' })
      .expect(201);
    const campaignId: string = campaign.body.campaignId;
    for (const [user, role] of [
      [player, 'PLAYER'],
      [otherPlayer, 'PLAYER'],
      [viewer, 'VIEWER'],
    ] as const) {
      const invitation = await request(app.getHttpServer())
        .post(`/campaigns/${campaignId}/invitations`)
        .set(owner)
        .send({ role })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/invitations/${invitation.body.token}/accept`)
        .set(user)
        .expect(201);
    }
    return { owner, player, otherPlayer, viewer, outsider, campaignId };
  }

  async function createElement(
    user: Headers,
    campaignId: string,
    body: Record<string, unknown>,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/elements`)
      .set(user)
      .send(body)
      .expect(201);
    return response.body.elementId;
  }

  function setAccess(user: Headers, elementId: string, value: string) {
    return request(app.getHttpServer())
      .patch(`/elements/${elementId}/access`)
      .set(user)
      .send({ access: value })
      .expect(200);
  }

  function upload(
    user: Headers,
    elementId: string,
    slot: 'cover' | 'map',
    file: Buffer,
  ) {
    return request(app.getHttpServer())
      .post(`/elements/${elementId}/${slot}`)
      .set(user)
      .attach('file', file, {
        filename: 'image.png',
        contentType: 'image/png',
      });
  }

  function canReadMedia(user: Headers, url: string, expected: boolean) {
    return request(app.getHttpServer())
      .get(url)
      .set(user)
      .expect(expected ? 200 : 404);
  }

  it('delivers an element cover by the current element access', async () => {
    const { owner, player, viewer, outsider, campaignId } =
      await setupCampaign();
    const elementId = await createElement(owner, campaignId, {
      type: 'NPC',
      title: 'Technician',
      typeData: { role: 'Engineer' },
    });

    await upload(
      player,
      elementId,
      'cover',
      await createImage(600, 800),
    ).expect(404);
    await upload(
      viewer,
      elementId,
      'cover',
      await createImage(600, 800),
    ).expect(404);

    const uploaded = await upload(
      owner,
      elementId,
      'cover',
      await createImage(3000, 2000),
    ).expect(201);
    const coverUrl: string = uploaded.body.coverUrl;
    expect(coverUrl).toBe(`/media/${uploaded.body.assetId}`);

    const element = await request(app.getHttpServer())
      .get(`/elements/${elementId}`)
      .set(owner)
      .expect(200);
    expect(element.body).toMatchObject({
      coverUrl,
      coverAssetId: uploaded.body.assetId,
    });

    const delivered = await canReadMedia(owner, coverUrl, true);
    expect(delivered.headers['content-type']).toBe('image/webp');
    const metadata = await sharp(delivered.body as Buffer).metadata();
    expect(metadata).toMatchObject({
      format: 'webp',
      width: 1024,
      height: 683,
    });
    await canReadMedia(player, coverUrl, false);
    await canReadMedia(viewer, coverUrl, false);

    await setAccess(owner, elementId, 'SHARED');
    await canReadMedia(player, coverUrl, true);
    await canReadMedia(viewer, coverUrl, true);
    await canReadMedia(outsider, coverUrl, false);

    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(player)
      .send({ cardKind: 'ELEMENT_REFERENCE', elementId })
      .expect(201)
      .expect((response) =>
        expect(response.body.reference).toEqual({
          kind: 'ELEMENT',
          elementId,
          coverUrl,
        }),
      );
    const board = await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/investigation-board`)
      .set(viewer)
      .expect(200);
    expect(board.body.cards[0].reference.coverUrl).toBe(coverUrl);

    await setAccess(owner, elementId, 'MASTER_ONLY');
    await canReadMedia(player, coverUrl, false);
    await canReadMedia(viewer, coverUrl, false);

    const replaced = await upload(
      owner,
      elementId,
      'cover',
      await createImage(512, 512),
    ).expect(201);
    await canReadMedia(owner, coverUrl, false);
    await canReadMedia(owner, replaced.body.coverUrl, true);

    await request(app.getHttpServer())
      .delete(`/elements/${elementId}/cover`)
      .set(owner)
      .expect(204);
    await canReadMedia(owner, replaced.body.coverUrl, false);
    await request(app.getHttpServer())
      .delete(`/elements/${elementId}/cover`)
      .set(owner)
      .expect(404);
    expect(await storedFiles()).toEqual([]);
  });

  it('lets a player manage the cover of their own note only', async () => {
    const { owner, player, otherPlayer, campaignId } = await setupCampaign();
    const noteId = await createElement(player, campaignId, {
      type: 'NOTE',
      title: 'Clues',
    });
    const uploaded = await upload(
      player,
      noteId,
      'cover',
      await createImage(800, 600),
    ).expect(201);

    await canReadMedia(player, uploaded.body.coverUrl, true);
    await canReadMedia(owner, uploaded.body.coverUrl, false);
    await canReadMedia(otherPlayer, uploaded.body.coverUrl, false);
    await upload(owner, noteId, 'cover', await createImage(800, 600)).expect(
      404,
    );
    await request(app.getHttpServer())
      .delete(`/elements/${noteId}/cover`)
      .set(otherPlayer)
      .expect(404);

    await setAccess(player, noteId, 'MASTER_ONLY');
    await canReadMedia(owner, uploaded.body.coverUrl, true);
    await canReadMedia(otherPlayer, uploaded.body.coverUrl, false);
  });

  it('validates element cover dimensions and format', async () => {
    const { owner, campaignId } = await setupCampaign();
    const elementId = await createElement(owner, campaignId, {
      type: 'OTHER',
      title: 'Artifact',
    });

    await upload(owner, elementId, 'cover', await createImage(1200, 400))
      .expect(400)
      .expect((response) =>
        expect(response.body.code).toBe(
          'media.invalid_element_cover_dimensions',
        ),
      );
    await upload(owner, elementId, 'cover', await createImage(200, 200))
      .expect(400)
      .expect((response) =>
        expect(response.body.code).toBe(
          'media.invalid_element_cover_dimensions',
        ),
      );
    await upload(owner, elementId, 'cover', Buffer.from('<svg></svg>'))
      .expect(400)
      .expect((response) =>
        expect(response.body.code).toBe('media.unsupported_type'),
      );
    expect(await storedFiles()).toEqual([]);
  });

  it('uploads location maps through a temporary file and follows element access', async () => {
    const { owner, player, viewer, outsider, campaignId } =
      await setupCampaign();
    const locationId = await createElement(owner, campaignId, {
      type: 'LOCATION',
      title: 'Power plant',
      imageUrl: 'https://example.com/map.png',
    });
    const noteId = await createElement(owner, campaignId, {
      type: 'NOTE',
      title: 'Notes',
    });
    const before = await pendingUploads();

    await upload(
      player,
      locationId,
      'map',
      await createImage(1600, 900),
    ).expect(404);
    await upload(owner, noteId, 'map', await createImage(1600, 900))
      .expect(400)
      .expect((response) =>
        expect(response.body.code).toBe('media.location_only'),
      );
    await upload(owner, locationId, 'map', await createImage(900, 600))
      .expect(400)
      .expect((response) =>
        expect(response.body.code).toBe('media.invalid_map_dimensions'),
      );
    await upload(owner, locationId, 'map', Buffer.from('not an image'))
      .expect(400)
      .expect((response) =>
        expect(response.body.code).toBe('media.unsupported_type'),
      );
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(
      oversized,
    );
    await upload(owner, locationId, 'map', oversized)
      .expect(413)
      .expect((response) =>
        expect(response.body.code).toBe('media.file_too_large'),
      );

    const uploaded = await upload(
      owner,
      locationId,
      'map',
      await createImage(6000, 3000),
    ).expect(201);
    const imageUrl: string = uploaded.body.imageUrl;
    expect(imageUrl).toBe(`/media/${uploaded.body.assetId}`);
    expect(await pendingUploads()).toEqual(before);

    const delivered = await canReadMedia(owner, imageUrl, true);
    expect(await sharp(delivered.body as Buffer).metadata()).toMatchObject({
      format: 'webp',
      width: 4096,
      height: 2048,
    });
    await canReadMedia(player, imageUrl, false);
    await setAccess(owner, locationId, 'SHARED');
    await canReadMedia(player, imageUrl, true);
    await canReadMedia(viewer, imageUrl, true);
    await canReadMedia(outsider, imageUrl, false);

    const element = await request(app.getHttpServer())
      .get(`/elements/${locationId}`)
      .set(player)
      .expect(200);
    expect(element.body).toMatchObject({
      imageUrl,
      mapAssetId: uploaded.body.assetId,
    });

    // An explicit external URL replaces the uploaded map file.
    await request(app.getHttpServer())
      .patch(`/elements/${locationId}`)
      .set(owner)
      .send({ imageUrl: 'https://example.com/new-map.png' })
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          imageUrl: 'https://example.com/new-map.png',
          mapAssetId: null,
        }),
      );
    await canReadMedia(owner, imageUrl, false);
    expect(await storedFiles()).toEqual([]);

    const second = await upload(
      owner,
      locationId,
      'map',
      await createImage(1024, 256),
    ).expect(201);
    await request(app.getHttpServer())
      .delete(`/elements/${locationId}/map`)
      .set(player)
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/elements/${locationId}/map`)
      .set(owner)
      .expect(204);
    await canReadMedia(owner, second.body.imageUrl, false);
    await request(app.getHttpServer())
      .get(`/elements/${locationId}`)
      .set(owner)
      .expect(200)
      .expect((response) => expect(response.body.imageUrl).toBeNull());
    expect(await storedFiles()).toEqual([]);
  });

  it('removes element media files when the element or the campaign is deleted', async () => {
    const { owner, campaignId } = await setupCampaign();
    const locationId = await createElement(owner, campaignId, {
      type: 'LOCATION',
      title: 'Lake',
    });
    const npcId = await createElement(owner, campaignId, {
      type: 'NPC',
      title: 'Guard',
      typeData: { role: 'Guard' },
    });
    await upload(
      owner,
      locationId,
      'cover',
      await createImage(800, 600),
    ).expect(201);
    await upload(
      owner,
      locationId,
      'map',
      await createImage(2048, 1024),
    ).expect(201);
    await upload(owner, npcId, 'cover', await createImage(600, 800)).expect(
      201,
    );
    expect(await storedFiles()).toHaveLength(3);

    await request(app.getHttpServer())
      .delete(`/elements/${locationId}`)
      .set(owner)
      .expect(200);
    expect(await storedFiles()).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/campaigns/${campaignId}`)
      .set(owner)
      .expect(200);
    expect(await storedFiles()).toEqual([]);
    expect(await getTestPrisma().mediaAsset.count()).toBe(0);
  });

  it('reconciles unreferenced asset rows and files', async () => {
    const { owner, campaignId } = await setupCampaign();
    const elementId = await createElement(owner, campaignId, {
      type: 'OTHER',
      title: 'Kept',
    });
    const kept = await upload(
      owner,
      elementId,
      'cover',
      await createImage(512, 512),
    ).expect(201);

    // Orphans are backdated past the grace period; fresh entries are kept.
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const orphanKey = `${randomUUID()}.webp`;
    await writeFile(join(mediaStoragePath, orphanKey), 'orphan');
    await getTestPrisma().mediaAsset.create({
      data: {
        storageKey: orphanKey,
        purpose: 'ELEMENT_COVER',
        byteSize: 6,
        width: 1,
        height: 1,
        createdAt: past,
      },
    });
    const strayFile = join(mediaStoragePath, `${randomUUID()}.webp.tmp`);
    await writeFile(strayFile, 'stray');
    await utimes(strayFile, past, past);
    const freshFile = join(mediaStoragePath, `${randomUUID()}.webp.tmp`);
    await writeFile(freshFile, 'in flight');

    const media = app.get(MediaService);
    const graceMs = 60 * 60 * 1000;
    const report = await media.reconcile({ apply: false, graceMs });
    expect(report).toMatchObject({ applied: false, orphanAssets: 1 });
    // Abandoned temporary uploads outside the storage directory count too.
    expect(report.orphanFiles).toBeGreaterThanOrEqual(1);
    expect(await storedFiles()).toHaveLength(4);

    await media.reconcile({ apply: true, graceMs });
    await access(freshFile);
    await rm(freshFile);
    expect(await storedFiles()).toHaveLength(1);
    await expect(access(strayFile)).rejects.toThrow();
    expect(await getTestPrisma().mediaAsset.count()).toBe(1);
    await canReadMedia(owner, kept.body.coverUrl, true);
  });
});
