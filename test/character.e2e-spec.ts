import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { closeTestDatabase, resetTestDatabase } from './helpers/database';

type AuthenticatedUser = {
  accessToken: string;
  email: string;
};

const password = 'test-password-123';
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
  drive: 'Find the truth behind the strange machines.',
  pride: 'I never abandon a friend.',
  problem: 'My parents do not understand me.',
  anchor: 'My older sister.',
  iconicItem: 'A cassette recorder',
};

async function registerUser(
  app: INestApplication,
  email: string,
  name: string,
): Promise<AuthenticatedUser> {
  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, name, password })
    .expect(201);

  return { accessToken: response.body.accessToken, email };
}

function authenticate(user: AuthenticatedUser) {
  return { Authorization: `Bearer ${user.accessToken}` };
}

async function createCampaign(app: INestApplication, owner: AuthenticatedUser) {
  const response = await request(app.getHttpServer())
    .post('/campaigns')
    .set(authenticate(owner))
    .send({ title: 'The Loop', description: 'A mystery in the 1980s' })
    .expect(201);

  return response.body;
}

describe('Characters (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('enforces character roles, ownership, and tenant isolation', async () => {
    const owner = await registerUser(app, 'owner@loopkeeper.dev', 'Owner');
    const player = await registerUser(app, 'player@loopkeeper.dev', 'Player');
    const viewer = await registerUser(app, 'viewer@loopkeeper.dev', 'Viewer');
    const outsider = await registerUser(
      app,
      'outsider@loopkeeper.dev',
      'Outsider',
    );
    const campaign = await createCampaign(app, owner);

    await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/members`)
      .set(authenticate(owner))
      .send({ email: player.email, role: 'PLAYER' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/members`)
      .set(authenticate(owner))
      .send({ email: viewer.email, role: 'VIEWER' })
      .expect(201);

    const templates = await request(app.getHttpServer())
      .get('/game-systems/TALES_FROM_THE_LOOP/templates')
      .set(authenticate(player))
      .expect(200);
    expect(templates.body).toHaveLength(1);
    const templateId = templates.body[0].templateId;

    const playerCharacter = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/characters`)
      .set(authenticate(player))
      .send({ name: 'Alex', templateId, data: characterData })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/characters`)
      .set(authenticate(player))
      .send({ name: 'Another Alex', templateId, data: characterData })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/characters`)
      .set(authenticate(player))
      .send({
        name: 'Not an NPC',
        templateId,
        data: characterData,
        isNPC: true,
      })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/characters`)
      .set(authenticate(viewer))
      .send({ name: 'Viewer', templateId, data: characterData })
      .expect(404);

    const npc = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/characters`)
      .set(authenticate(owner))
      .send({ name: 'Mr. Berg', templateId, data: characterData, isNPC: true })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/campaigns/${campaign.campaignId}/characters`)
      .set(authenticate(viewer))
      .expect(200)
      .expect((response) => expect(response.body).toHaveLength(2));

    await request(app.getHttpServer())
      .patch(`/characters/${npc.body.characterId}`)
      .set(authenticate(player))
      .send({ name: 'Changed NPC' })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/characters/${npc.body.characterId}`)
      .set(authenticate(owner))
      .send({ name: 'Mr. Berg Updated' })
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({ name: 'Mr. Berg Updated' }),
      );

    await request(app.getHttpServer())
      .get(`/characters/${playerCharacter.body.characterId}`)
      .set(authenticate(outsider))
      .expect(404);
  });

  it('validates data against the selected template', async () => {
    const owner = await registerUser(app, 'owner@loopkeeper.dev', 'Owner');
    const player = await registerUser(app, 'player@loopkeeper.dev', 'Player');
    const campaign = await createCampaign(app, owner);

    await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/members`)
      .set(authenticate(owner))
      .send({ email: player.email, role: 'PLAYER' })
      .expect(201);

    const templates = await request(app.getHttpServer())
      .get('/game-systems/TALES_FROM_THE_LOOP/templates')
      .set(authenticate(player))
      .expect(200);
    const templateId = templates.body[0].templateId;

    await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/characters`)
      .set(authenticate(player))
      .send({
        name: 'Invalid character',
        templateId,
        data: { ...characterData, age: 25, unexpected: true },
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/characters`)
      .set(authenticate(player))
      .send({
        name: 'Wrong template',
        templateId: '11111111-1111-4111-8111-111111111111',
        data: characterData,
      })
      .expect(404);
  });
});
