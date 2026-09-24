import { rm } from 'node:fs/promises';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import sharp from 'sharp';
import { createTestApp } from './helpers/app';
import {
  closeTestDatabase,
  getTestPrisma,
  resetTestDatabase,
} from './helpers/database';

const password = 'test-password-123';
const mediaStoragePath = 'data/test-media';
const importFileType = Function('return import("file-type")') as () => Promise<
  typeof import('file-type')
>;

type AuthenticatedUser = {
  accessToken: string;
};

async function registerUser(
  app: INestApplication,
  email: string,
): Promise<AuthenticatedUser> {
  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, name: 'Media User', password })
    .expect(201);

  return { accessToken: response.body.accessToken };
}

function authenticate(user: AuthenticatedUser) {
  return { Authorization: `Bearer ${user.accessToken}` };
}

async function createImage(
  width: number,
  height: number,
  format: 'jpeg' | 'png' | 'webp' = 'png',
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 12, g: 34, b: 56 },
    },
  })
    [format]()
    .toBuffer();
}

describe('Media (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    await rm(mediaStoragePath, { recursive: true, force: true });
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await rm(mediaStoragePath, { recursive: true, force: true });
    await closeTestDatabase();
  });

  it('uploads a signature-detected image and delivers a normalized private WebP avatar', async () => {
    const user = await registerUser(app, 'media@loopkeeper.dev');
    const source = await createImage(256, 256, 'jpeg');

    const uploadResponse = await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set(authenticate(user))
      .attach('file', source, {
        filename: 'avatar.jpg',
        contentType: 'text/plain',
      })
      .expect(201);

    expect(uploadResponse.body).toMatchObject({
      avatarUrl: `/media/${uploadResponse.body.assetId}`,
    });

    const profileResponse = await request(app.getHttpServer())
      .get('/users/me')
      .set(authenticate(user))
      .expect(200);
    expect(profileResponse.body.avatarUrl).toBe(uploadResponse.body.avatarUrl);

    const deliveryResponse = await request(app.getHttpServer())
      .get(uploadResponse.body.avatarUrl)
      .set(authenticate(user))
      .expect(200);

    expect(deliveryResponse.headers['content-type']).toMatch(/^image\/webp/);
    expect(deliveryResponse.headers['x-content-type-options']).toBe('nosniff');
    expect(deliveryResponse.headers['cache-control']).toBe(
      'private, max-age=0, must-revalidate',
    );
    const { fileTypeFromBuffer } = await importFileType();
    expect((await fileTypeFromBuffer(deliveryResponse.body))?.mime).toBe(
      'image/webp',
    );
    await expect(
      sharp(deliveryResponse.body).metadata(),
    ).resolves.toMatchObject({
      width: 256,
      height: 256,
      format: 'webp',
    });
  });

  it('rejects unsupported signatures and invalid decoded dimensions', async () => {
    const user = await registerUser(app, 'validation@loopkeeper.dev');

    await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set(authenticate(user))
      .attach('file', Buffer.from('GIF89a'), 'avatar.gif')
      .expect(400)
      .expect((response) =>
        expect(response.body.code).toBe('media.unsupported_type'),
      );

    await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set(authenticate(user))
      .attach('file', await createImage(256, 512), 'rectangle.png')
      .expect(400)
      .expect((response) =>
        expect(response.body.code).toBe('media.invalid_dimensions'),
      );

    await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set(authenticate(user))
      .attach('file', await createImage(128, 128), 'small.webp')
      .expect(400)
      .expect((response) =>
        expect(response.body.code).toBe('media.invalid_dimensions'),
      );
  });

  it('requires authentication and allows authenticated users to read avatars', async () => {
    const owner = await registerUser(app, 'owner-media@loopkeeper.dev');
    const otherUser = await registerUser(app, 'other-media@loopkeeper.dev');
    const uploadResponse = await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set(authenticate(owner))
      .attach('file', await createImage(256, 256), 'avatar.png')
      .expect(201);

    await request(app.getHttpServer())
      .get(uploadResponse.body.avatarUrl)
      .expect(401);

    await request(app.getHttpServer())
      .get(uploadResponse.body.avatarUrl)
      .set(authenticate(otherUser))
      .expect(200);
  });

  it('replaces and deletes avatars without leaving accessible assets', async () => {
    const user = await registerUser(app, 'replace-media@loopkeeper.dev');
    const firstUpload = await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set(authenticate(user))
      .attach('file', await createImage(256, 256, 'png'), 'first.png')
      .expect(201);

    const secondUpload = await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set(authenticate(user))
      .attach('file', await createImage(512, 512, 'webp'), 'second.webp')
      .expect(201);

    await request(app.getHttpServer())
      .get(firstUpload.body.avatarUrl)
      .set(authenticate(user))
      .expect(404);
    await request(app.getHttpServer())
      .get(secondUpload.body.avatarUrl)
      .set(authenticate(user))
      .expect(200);
    expect(await getTestPrisma().mediaAsset.count()).toBe(1);

    await request(app.getHttpServer())
      .delete('/users/me/avatar')
      .set(authenticate(user))
      .expect(204);

    const profileResponse = await request(app.getHttpServer())
      .get('/users/me')
      .set(authenticate(user))
      .expect(200);
    expect(profileResponse.body.avatarUrl).toBeNull();
    expect(await getTestPrisma().mediaAsset.count()).toBe(0);

    await request(app.getHttpServer())
      .get(secondUpload.body.avatarUrl)
      .set(authenticate(user))
      .expect(404);
  });
});
