import { readdir, rm } from 'node:fs/promises';
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
const characterData = {
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

type Headers = { Authorization: string };

function createImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 40, g: 70, b: 90 } },
  })
    .png()
    .toBuffer();
}

// Many registrations (Argon2) and image uploads in one scenario.
jest.setTimeout(30_000);

describe('Campaign deletion (e2e)', () => {
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

  async function createCampaign(owner: Headers, title: string) {
    const response = await request(app.getHttpServer())
      .post('/campaigns')
      .set(owner)
      .send({ title, description: 'A campaign', system: 'TALES_FROM_THE_LOOP' })
      .expect(201);
    return response.body.campaignId as string;
  }

  async function invite(owner: Headers, campaignId: string, role: string) {
    const response = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/invitations`)
      .set(owner)
      .send({ role })
      .expect(201);
    return response.body.token as string;
  }

  function attach(user: Headers, path: string, file: Buffer) {
    return request(app.getHttpServer())
      .post(path)
      .set(user)
      .attach('file', file, { filename: 'image.png', contentType: 'image/png' })
      .expect(201);
  }

  it('deletes a populated campaign with everything it owns and nothing else', async () => {
    const owner = await register('owner@loopkeeper.dev');
    const player = await register('player@loopkeeper.dev');
    const viewer = await register('viewer@loopkeeper.dev');
    const campaignId = await createCampaign(owner, 'Doomed');
    const otherCampaignId = await createCampaign(owner, 'Kept');

    for (const [user, role] of [
      [player, 'PLAYER'],
      [viewer, 'VIEWER'],
    ] as const) {
      const token = await invite(owner, campaignId, role);
      await request(app.getHttpServer())
        .post(`/invitations/${token}/accept`)
        .set(user)
        .expect(201);
    }
    await invite(owner, campaignId, 'PLAYER'); // left pending

    const templates = await request(app.getHttpServer())
      .get('/game-systems/TALES_FROM_THE_LOOP/templates')
      .set(player)
      .expect(200);
    const character = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/characters`)
      .set(player)
      .send({
        name: 'Alex',
        templateId: templates.body[0].templateId,
        data: characterData,
      })
      .expect(201);
    await attach(
      player,
      `/characters/${character.body.characterId}/avatar`,
      await createImage(512, 512),
    );

    const element = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/elements`)
      .set(owner)
      .send({ type: 'LOCATION', title: 'Plant', access: 'SHARED' })
      .expect(201);
    const elementId: string = element.body.elementId;
    await attach(
      owner,
      `/elements/${elementId}/cover`,
      await createImage(800, 600),
    );
    await attach(
      owner,
      `/elements/${elementId}/map`,
      await createImage(2048, 1024),
    );
    await attach(
      owner,
      `/campaigns/${campaignId}/cover`,
      await createImage(1200, 700),
    );
    await attach(
      owner,
      `/campaigns/${campaignId}/backgrounds`,
      await createImage(1600, 900),
    );
    await attach(
      owner,
      `/campaigns/${otherCampaignId}/cover`,
      await createImage(1200, 700),
    );

    const freeCard = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(player)
      .send({ title: 'Lights at night' })
      .expect(201);
    const elementCard = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(player)
      .send({ cardKind: 'ELEMENT_REFERENCE', elementId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(owner)
      .send({
        cardKind: 'CHARACTER_REFERENCE',
        characterId: character.body.characterId,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/investigation-links`)
      .set(player)
      .send({
        cardAId: freeCard.body.cardId,
        cardBId: elementCard.body.cardId,
      })
      .expect(201);
    expect(await readdir(mediaStoragePath)).toHaveLength(6);

    await request(app.getHttpServer())
      .delete(`/campaigns/${campaignId}`)
      .set(player)
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/campaigns/${campaignId}`)
      .set(owner)
      .expect(200);

    const prisma = getTestPrisma();
    const where = { campaignId };
    expect(
      await Promise.all([
        prisma.campaign.count({ where }),
        prisma.campaignMember.count({ where }),
        prisma.campaignInvitation.count({ where }),
        prisma.character.count({ where }),
        prisma.campaignElement.count({ where }),
        prisma.investigationBoard.count({ where }),
        prisma.investigationCard.count({ where }),
        prisma.investigationLink.count({ where }),
      ]),
    ).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    // Only the other campaign's cover remains.
    expect(await readdir(mediaStoragePath)).toHaveLength(1);
    expect(await prisma.mediaAsset.count()).toBe(1);

    for (const user of [owner, player, viewer]) {
      await request(app.getHttpServer())
        .get(`/campaigns/${campaignId}`)
        .set(user)
        .expect(404);
      await request(app.getHttpServer()).get('/users/me').set(user).expect(200);
    }
    await request(app.getHttpServer())
      .get(`/campaigns/${otherCampaignId}`)
      .set(owner)
      .expect(200);
  });
});
