import { access, rm } from 'node:fs/promises';
import { join } from 'node:path';
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
const playerCharacterData = {
  age: 15,
  type: 'COMPUTER_GEEK',
  body: 3,
  tech: 4,
  heart: 2,
  mind: 3,
  force: 1,
  move: 2,
  sneak: 2,
  tinker: 3,
  program: 3,
  calculate: 2,
  contact: 1,
  charm: 1,
  lead: 0,
  investigate: 2,
  comprehend: 2,
  empathize: 1,
  drive: 'Drive',
  pride: 'Pride',
  problem: 'Problem',
  anchor: 'Anchor',
  iconicItem: 'Item',
};

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

async function inviteAndAccept(
  app: INestApplication,
  owner: AuthenticatedUser,
  invitedUser: AuthenticatedUser,
  campaignId: string,
  role: 'PLAYER' | 'VIEWER',
) {
  const invitation = await request(app.getHttpServer())
    .post(`/campaigns/${campaignId}/invitations`)
    .set(authenticate(owner))
    .send({ role })
    .expect(201);

  await request(app.getHttpServer())
    .post(`/invitations/${invitation.body.token}/accept`)
    .set(authenticate(invitedUser))
    .expect(201);
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

    await expect(
      sharp(deliveryResponse.body).metadata(),
    ).resolves.toMatchObject({
      width: 512,
      height: 512,
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

    const rectangularUpload = await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set(authenticate(user))
      .attach('file', await createImage(256, 512), 'rectangle.png')
      .expect(201);

    const rectangularAvatar = await request(app.getHttpServer())
      .get(rectangularUpload.body.avatarUrl)
      .set(authenticate(user))
      .expect(200);
    await expect(
      sharp(rectangularAvatar.body).metadata(),
    ).resolves.toMatchObject({
      width: 512,
      height: 512,
      format: 'webp',
    });

    await request(app.getHttpServer())
      .post('/users/me/avatar')
      .set(authenticate(user))
      .attach('file', await createImage(128, 128), 'small.webp')
      .expect(400)
      .expect((response) =>
        expect(response.body.code).toBe('media.invalid_dimensions'),
      );
  });

  it('bounds multipart uploads for every image endpoint before storing them', async () => {
    const owner = await registerUser(app, 'limits-media@loopkeeper.dev');
    const campaign = await request(app.getHttpServer())
      .post('/campaigns')
      .set(authenticate(owner))
      .send({
        title: 'Limits',
        description: 'Upload limits',
        system: 'TALES_FROM_THE_LOOP',
      })
      .expect(201);
    const templates = await request(app.getHttpServer())
      .get('/game-systems/TALES_FROM_THE_LOOP/templates')
      .set(authenticate(owner))
      .expect(200);
    const playerTemplateId = templates.body[0].templateId;
    const player = await registerUser(app, 'limits-player@loopkeeper.dev');
    await inviteAndAccept(app, owner, player, campaign.body.campaignId, 'PLAYER');
    const character = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.body.campaignId}/characters`)
      .set(authenticate(player))
      .send({
        name: 'Player character',
        templateId: playerTemplateId,
        data: playerCharacterData,
      })
      .expect(201);
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 1);
    for (const url of [
      '/users/me/avatar',
      `/characters/${character.body.characterId}/avatar`,
      `/campaigns/${campaign.body.campaignId}/cover`,
    ]) {
      await request(app.getHttpServer())
        .post(url)
        .set(authenticate(owner))
        .attach('file', oversized, 'large.png')
        .expect(413)
        .expect((response) =>
          expect(response.body.code).toBe('media.file_too_large'),
        );
      await request(app.getHttpServer())
        .post(url)
        .set(authenticate(owner))
        .attach('file', await createImage(640, 360), 'first.png')
        .attach('file', await createImage(640, 360), 'second.png')
        .expect(400);
      await request(app.getHttpServer())
        .post(url)
        .set(authenticate(owner))
        .field('unexpected', 'value')
        .attach('file', await createImage(640, 360), 'image.png')
        .expect(400);
    }
    expect(await getTestPrisma().mediaAsset.count()).toBe(0);
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

  it('stores only attached local backgrounds and delivers them to owners and players', async () => {
    const owner = await registerUser(app, 'background-owner@loopkeeper.dev');
    const player = await registerUser(app, 'background-player@loopkeeper.dev');
    const viewer = await registerUser(app, 'background-viewer@loopkeeper.dev');
    const outsider = await registerUser(
      app,
      'background-outsider@loopkeeper.dev',
    );
    const campaign = await request(app.getHttpServer())
      .post('/campaigns')
      .set(authenticate(owner))
      .send({
        title: 'Backgrounds',
        description: 'Test',
        system: 'TALES_FROM_THE_LOOP',
      })
      .expect(201);
    const otherCampaign = await request(app.getHttpServer())
      .post('/campaigns')
      .set(authenticate(outsider))
      .send({
        title: 'Other',
        description: 'Test',
        system: 'TALES_FROM_THE_LOOP',
      })
      .expect(201);
    const base = `/campaigns/${campaign.body.campaignId}`;
    await inviteAndAccept(
      app,
      owner,
      player,
      campaign.body.campaignId,
      'PLAYER',
    );
    await inviteAndAccept(
      app,
      owner,
      viewer,
      campaign.body.campaignId,
      'VIEWER',
    );

    for (const user of [player, viewer, outsider]) {
      await request(app.getHttpServer())
        .post(`${base}/backgrounds`)
        .set(authenticate(user))
        .attach('file', await createImage(1600, 900), 'background.png')
        .expect(404);
    }
    for (const [width, height, format] of [
      [1600, 900, 'png'],
      [1920, 1080, 'jpeg'],
      [2560, 1440, 'webp'],
    ] as const) {
      const response = await request(app.getHttpServer())
        .post(`${base}/backgrounds`)
        .set(authenticate(owner))
        .attach(
          'file',
          await createImage(width, height, format),
          `background.${format}`,
        )
        .expect(201);
      expect(response.body).toMatchObject({
        backgroundId: expect.any(String),
        imageUrl: `/media/${response.body.backgroundId}`,
        isEnabled: true,
      });
      const delivered = await request(app.getHttpServer())
        .get(response.body.imageUrl)
        .set(authenticate(player))
        .expect(200);
      await expect(sharp(delivered.body).metadata()).resolves.toMatchObject({
        width,
        height,
        format: 'webp',
      });
      for (const user of [viewer, outsider]) {
        await request(app.getHttpServer())
          .get(response.body.imageUrl)
          .set(authenticate(user))
          .expect(404);
      }
      await request(app.getHttpServer())
        .get(response.body.imageUrl)
        .expect(401);
      await request(app.getHttpServer())
        .get(response.body.imageUrl)
        .set(authenticate(owner))
        .expect(200);
      await request(app.getHttpServer())
        .delete(
          `/campaigns/${otherCampaign.body.campaignId}/backgrounds/${response.body.backgroundId}`,
        )
        .set(authenticate(outsider))
        .expect(404);
    }
    const settings = await request(app.getHttpServer())
      .get(`${base}/background-settings`)
      .set(authenticate(owner))
      .expect(200);
    const first = settings.body.backgrounds[0];
    const forged = {
      ...first,
      backgroundId: '11111111-1111-4111-8111-111111111111',
      imageUrl: '/media/11111111-1111-4111-8111-111111111111',
    };
    await request(app.getHttpServer())
      .patch(`${base}/background-settings`)
      .set(authenticate(owner))
      .send({
        ...settings.body,
        backgrounds: [...settings.body.backgrounds, forged],
      })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`${base}/background-settings`)
      .set(authenticate(owner))
      .send({
        ...settings.body,
        backgrounds: settings.body.backgrounds.slice(1),
      })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/campaigns/${otherCampaign.body.campaignId}/background-settings`)
      .set(authenticate(outsider))
      .send({ ...settings.body, backgrounds: [first] })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`${base}/background-settings`)
      .set(authenticate(owner))
      .send({
        ...settings.body,
        selectionMode: 'RANDOM',
        backgrounds: settings.body.backgrounds.map(
          (background: { backgroundId: string }) => ({
            ...background,
            isEnabled: background.backgroundId !== first.backgroundId,
          }),
        ),
      })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`${base}/backgrounds/${first.backgroundId}`)
      .set(authenticate(player))
      .expect(404);
    await request(app.getHttpServer())
      .delete(`${base}/backgrounds/${first.backgroundId}`)
      .set(authenticate(owner))
      .expect(204);
    await request(app.getHttpServer())
      .get(first.imageUrl)
      .set(authenticate(owner))
      .expect(404);
    expect(
      await getTestPrisma().mediaAsset.findUnique({
        where: { assetId: first.backgroundId },
      }),
    ).toBeNull();
    await request(app.getHttpServer())
      .delete(`${base}/backgrounds/${first.backgroundId}`)
      .set(authenticate(owner))
      .expect(404);
  });

  it('removes local background files when an empty campaign is deleted', async () => {
    const owner = await registerUser(app, 'background-cleanup@loopkeeper.dev');
    const campaign = await request(app.getHttpServer())
      .post('/campaigns')
      .set(authenticate(owner))
      .send({
        title: 'Cleanup',
        description: 'Test',
        system: 'TALES_FROM_THE_LOOP',
      })
      .expect(201);
    const uploaded = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.body.campaignId}/backgrounds`)
      .set(authenticate(owner))
      .attach('file', await createImage(1600, 900), 'background.png')
      .expect(201);
    const asset = await getTestPrisma().mediaAsset.findUniqueOrThrow({
      where: { assetId: uploaded.body.backgroundId },
    });
    await request(app.getHttpServer())
      .delete(`/campaigns/${campaign.body.campaignId}`)
      .set(authenticate(owner))
      .expect(200);
    expect(
      await getTestPrisma().mediaAsset.findUnique({
        where: { assetId: asset.assetId },
      }),
    ).toBeNull();
    await expect(
      access(join(mediaStoragePath, asset.storageKey)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects invalid background uploads without attaching assets', async () => {
    const owner = await registerUser(
      app,
      'background-validation@loopkeeper.dev',
    );
    const campaign = await request(app.getHttpServer())
      .post('/campaigns')
      .set(authenticate(owner))
      .send({
        title: 'Validation',
        description: 'Test',
        system: 'TALES_FROM_THE_LOOP',
      })
      .expect(201);
    const url = `/campaigns/${campaign.body.campaignId}/backgrounds`;
    for (const [image, code] of [
      [await createImage(1280, 720), 'media.invalid_background_dimensions'],
      [await createImage(900, 1600), 'media.invalid_background_dimensions'],
      [Buffer.from('GIF89a'), 'media.unsupported_type'],
    ] as const) {
      await request(app.getHttpServer())
        .post(url)
        .set(authenticate(owner))
        .attach('file', image, 'background.png')
        .expect(400)
        .expect((response) => expect(response.body.code).toBe(code));
    }
    await request(app.getHttpServer())
      .post(url)
      .set(authenticate(owner))
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), 'large.png')
      .expect(413);
    expect(await getTestPrisma().mediaAsset.count()).toBe(0);
  });

  it('authorizes character avatars and campaign covers and removes replaced assets', async () => {
    const owner = await registerUser(
      app,
      'campaign-owner-media@loopkeeper.dev',
    );
    const player = await registerUser(
      app,
      'campaign-player-media@loopkeeper.dev',
    );
    const viewer = await registerUser(
      app,
      'campaign-viewer-media@loopkeeper.dev',
    );
    const outsider = await registerUser(
      app,
      'campaign-outsider-media@loopkeeper.dev',
    );
    const campaign = await request(app.getHttpServer())
      .post('/campaigns')
      .set(authenticate(owner))
      .send({
        title: 'Media campaign',
        description: 'Media tests',
        system: 'TALES_FROM_THE_LOOP',
      })
      .expect(201);

    await inviteAndAccept(
      app,
      owner,
      player,
      campaign.body.campaignId,
      'PLAYER',
    );
    await inviteAndAccept(
      app,
      owner,
      viewer,
      campaign.body.campaignId,
      'VIEWER',
    );

    const templates = await request(app.getHttpServer())
      .get('/game-systems/TALES_FROM_THE_LOOP/templates')
      .set(authenticate(owner))
      .expect(200);
    const playerTemplateId = templates.body[0].templateId;
    const playerCharacter = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.body.campaignId}/characters`)
      .set(authenticate(player))
      .send({
        name: 'Player character',
        templateId: playerTemplateId,
        data: playerCharacterData,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/characters/${playerCharacter.body.characterId}/avatar`)
      .set(authenticate(viewer))
      .attach('file', await createImage(256, 256), 'avatar.png')
      .expect(404);

    await request(app.getHttpServer())
      .post(`/characters/${playerCharacter.body.characterId}/avatar`)
      .set(authenticate(owner))
      .attach('file', await createImage(256, 256), 'avatar.png')
      .expect(404);
    await request(app.getHttpServer())
      .post(`/characters/${playerCharacter.body.characterId}/avatar`)
      .set(authenticate(outsider))
      .attach('file', await createImage(256, 256), 'avatar.png')
      .expect(404);

    expect(await getTestPrisma().mediaAsset.count()).toBe(0);
    await expect(access(mediaStoragePath)).rejects.toMatchObject({
      code: 'ENOENT',
    });

    const firstCharacterAvatar = await request(app.getHttpServer())
      .post(`/characters/${playerCharacter.body.characterId}/avatar`)
      .set(authenticate(player))
      .attach('file', await createImage(256, 256), 'avatar.png')
      .expect(201);
    const secondCharacterAvatar = await request(app.getHttpServer())
      .post(`/characters/${playerCharacter.body.characterId}/avatar`)
      .set(authenticate(player))
      .attach('file', await createImage(512, 512), 'avatar.png')
      .expect(201);
    const members = await request(app.getHttpServer())
      .get(`/campaigns/${campaign.body.campaignId}/members`)
      .set(authenticate(owner))
      .expect(200);
    const playerMember = members.body.find(
      (member: { campaignRole: string }) => member.campaignRole === 'PLAYER',
    );
    await request(app.getHttpServer())
      .patch(
        `/campaigns/${campaign.body.campaignId}/members/${playerMember.user.userId}`,
      )
      .set(authenticate(owner))
      .send({ role: 'VIEWER' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/characters/${playerCharacter.body.characterId}/avatar`)
      .set(authenticate(player))
      .attach('file', await createImage(256, 256), 'avatar.png')
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/characters/${playerCharacter.body.characterId}/avatar`)
      .set(authenticate(player))
      .expect(404);
    await request(app.getHttpServer())
      .patch(
        `/campaigns/${campaign.body.campaignId}/members/${playerMember.user.userId}`,
      )
      .set(authenticate(owner))
      .send({ role: 'PLAYER' })
      .expect(200);


    await request(app.getHttpServer())
      .get(firstCharacterAvatar.body.avatarUrl)
      .set(authenticate(player))
      .expect(404);
    for (const user of [owner, player, viewer]) {
      await request(app.getHttpServer())
        .get(secondCharacterAvatar.body.avatarUrl)
        .set(authenticate(user))
        .expect(200);
    }
    await request(app.getHttpServer())
      .get(secondCharacterAvatar.body.avatarUrl)
      .set(authenticate(outsider))
      .expect(404);

    await request(app.getHttpServer())
      .post(`/campaigns/${campaign.body.campaignId}/cover`)
      .set(authenticate(player))
      .attach('file', await createImage(1600, 900), 'cover.png')
      .expect(404);
    expect(await getTestPrisma().mediaAsset.count()).toBe(1);
    const firstCover = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.body.campaignId}/cover`)
      .set(authenticate(owner))
      .attach('file', await createImage(1600, 900), 'cover.png')
      .expect(201);
    const firstCoverContent = await request(app.getHttpServer())
      .get(firstCover.body.coverUrl)
      .set(authenticate(player))
      .expect(200);
    await expect(
      sharp(firstCoverContent.body).metadata(),
    ).resolves.toMatchObject({
      width: 1280,
      height: 720,
      format: 'webp',
    });
    await request(app.getHttpServer())
      .post(`/campaigns/${campaign.body.campaignId}/cover`)
      .set(authenticate(owner))
      .attach('file', await createImage(800, 800), 'square.png')
      .expect(400)
      .expect((response) =>
        expect(response.body.code).toBe('media.invalid_cover_dimensions'),
      );
    const secondCover = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.body.campaignId}/cover`)
      .set(authenticate(owner))
      .attach('file', await createImage(900, 600), 'cover.png')
      .expect(201);

    await request(app.getHttpServer())
      .get(firstCover.body.coverUrl)
      .set(authenticate(viewer))
      .expect(404);
    const deliveredCover = await request(app.getHttpServer())
      .get(secondCover.body.coverUrl)
      .set(authenticate(viewer))
      .expect(200);
    await expect(sharp(deliveredCover.body).metadata()).resolves.toMatchObject({
      width: 900,
      height: 600,
      format: 'webp',
    });
    expect(
      await getTestPrisma().mediaAsset.findUnique({
        where: { assetId: secondCover.body.assetId },
        select: { width: true, height: true },
      }),
    ).toMatchObject({ width: 900, height: 600 });
    await request(app.getHttpServer())
      .get(secondCover.body.coverUrl)
      .set(authenticate(outsider))
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/characters/${playerCharacter.body.characterId}/avatar`)
      .set(authenticate(owner))
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/characters/${playerCharacter.body.characterId}/avatar`)
      .set(authenticate(viewer))
      .expect(404);
    for (const user of [player, viewer, outsider]) {
      await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.body.campaignId}/cover`)
        .set(authenticate(user))
        .expect(404);
    }

    await request(app.getHttpServer())
      .delete(`/characters/${playerCharacter.body.characterId}/avatar`)
      .set(authenticate(player))
      .expect(204);
    await request(app.getHttpServer())
      .delete(`/campaigns/${campaign.body.campaignId}/cover`)
      .set(authenticate(owner))
      .expect(204);
    await request(app.getHttpServer())
      .get(secondCharacterAvatar.body.avatarUrl)
      .set(authenticate(viewer))
      .expect(404);
    await request(app.getHttpServer())
      .get(secondCover.body.coverUrl)
      .set(authenticate(viewer))
      .expect(404);

    const characterResponse = await request(app.getHttpServer())
      .get(`/characters/${playerCharacter.body.characterId}`)
      .set(authenticate(player))
      .expect(200);
    expect(characterResponse.body.avatarUrl).toBeNull();
    const campaignResponse = await request(app.getHttpServer())
      .get(`/campaigns/${campaign.body.campaignId}`)
      .set(authenticate(owner))
      .expect(200);
    expect(campaignResponse.body.coverUrl).toBeNull();
    expect(await getTestPrisma().mediaAsset.count()).toBe(0);
  });

  it('preserves external URLs without serving superseded managed media', async () => {
    const owner = await registerUser(app, 'legacy-media@loopkeeper.dev');
    const campaign = await request(app.getHttpServer())
      .post('/campaigns')
      .set(authenticate(owner))
      .send({
        title: 'Legacy media',
        description: 'Legacy URLs',
        system: 'TALES_FROM_THE_LOOP',
      })
      .expect(201);
    const player = await registerUser(app, 'legacy-player@loopkeeper.dev');
    await inviteAndAccept(app, owner, player, campaign.body.campaignId, 'PLAYER');
    const templates = await request(app.getHttpServer())
      .get('/game-systems/TALES_FROM_THE_LOOP/templates')
      .set(authenticate(owner))
      .expect(200);
    const playerTemplateId = templates.body[0].templateId;
    const character = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.body.campaignId}/characters`)
      .set(authenticate(player))
      .send({
        name: 'Player character',
        templateId: playerTemplateId,
        data: playerCharacterData,
      })
      .expect(201);
    const avatar = await request(app.getHttpServer())
      .post(`/characters/${character.body.characterId}/avatar`)
      .set(authenticate(player))
      .attach('file', await createImage(256, 256), 'avatar.png')
      .expect(201);
    const cover = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.body.campaignId}/cover`)
      .set(authenticate(owner))
      .attach('file', await createImage(1600, 900), 'cover.png')
      .expect(201);

    const storedAvatar = await getTestPrisma().mediaAsset.findUniqueOrThrow({
      where: { assetId: avatar.body.assetId },
      select: { storageKey: true },
    });
    const storedCover = await getTestPrisma().mediaAsset.findUniqueOrThrow({
      where: { assetId: cover.body.assetId },
      select: { storageKey: true },
    });
    await request(app.getHttpServer())
      .patch(`/characters/${character.body.characterId}`)
      .set(authenticate(player))
      .send({ avatarUrl: 'https://example.com/character.png' })
      .expect(200)
      .expect((response) =>
        expect(response.body.avatarUrl).toBe(
          'https://example.com/character.png',
        ),
      );
    await request(app.getHttpServer())
      .patch(`/campaigns/${campaign.body.campaignId}`)
      .set(authenticate(owner))
      .send({ coverUrl: 'https://example.com/cover.png' })
      .expect(200)
      .expect((response) =>
        expect(response.body.coverUrl).toBe('https://example.com/cover.png'),
      );
    await request(app.getHttpServer())
      .get(avatar.body.avatarUrl)
      .set(authenticate(owner))
      .expect(404);
    await request(app.getHttpServer())
      .get(cover.body.coverUrl)
      .set(authenticate(owner))
      .expect(404);
    expect(await getTestPrisma().mediaAsset.count()).toBe(0);
    await expect(
      access(join(mediaStoragePath, storedAvatar.storageKey)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(
      access(join(mediaStoragePath, storedCover.storageKey)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
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
