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

async function createCampaign(app: INestApplication, owner: AuthenticatedUser) {
  const response = await request(app.getHttpServer())
    .post('/campaigns')
    .set(authenticate(owner))
    .send({
      title: 'The Loop',
      description: 'A mystery in the 1980s',
      system: 'TALES_FROM_THE_LOOP',
    })
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

    await inviteAndAccept(app, owner, player, campaign.campaignId, 'PLAYER');
    await inviteAndAccept(app, owner, viewer, campaign.campaignId, 'VIEWER');

    const playerCharacter = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/characters`)
      .set(authenticate(player))
      .send({ name: 'Alex', data: characterData })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/characters`)
      .set(authenticate(player))
      .send({
        name: 'Another Alex',

        data: characterData,
      })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/characters`)
      .set(authenticate(viewer))
      .send({
        name: 'Viewer',

        data: characterData,
      })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/characters`)
      .set(authenticate(owner))
      .send({
        name: 'Mr. Berg',

        data: {
          role: 'Loop technician',
          secret: 'Knows where the robot came from.',
        },
      })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/campaigns/${campaign.campaignId}/characters`)
      .set(authenticate(viewer))
      .expect(200)
      .expect((response) => expect(response.body).toHaveLength(1));

    const element = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/elements`)
      .set(authenticate(owner))
      .send({
        type: 'NPC',
        title: 'Mr. Berg',
        typeData: { role: 'Loop technician' },
      })
      .expect(201);
    expect(element.body.typeData.role).toBe('Loop technician');

    await request(app.getHttpServer())
      .get(`/characters/${playerCharacter.body.characterId}`)
      .set(authenticate(outsider))
      .expect(404);
  });

  it('keeps a player character under the control of its player only', async () => {
    const owner = await registerUser(app, 'owner@loopkeeper.dev', 'Owner');
    const player = await registerUser(app, 'player@loopkeeper.dev', 'Player');
    const otherPlayer = await registerUser(
      app,
      'other@loopkeeper.dev',
      'Other',
    );
    const viewer = await registerUser(app, 'viewer@loopkeeper.dev', 'Viewer');
    const campaign = await createCampaign(app, owner);
    await inviteAndAccept(app, owner, player, campaign.campaignId, 'PLAYER');
    await inviteAndAccept(
      app,
      owner,
      otherPlayer,
      campaign.campaignId,
      'PLAYER',
    );
    await inviteAndAccept(app, owner, viewer, campaign.campaignId, 'VIEWER');

    const created = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/characters`)
      .set(authenticate(player))
      .send({ name: 'Alex', data: characterData })
      .expect(201);
    const characterId: string = created.body.characterId;

    // Every member reads the sheet; nobody but its player changes it.
    for (const reader of [owner, otherPlayer, viewer]) {
      await request(app.getHttpServer())
        .get(`/characters/${characterId}`)
        .set(authenticate(reader))
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/characters/${characterId}`)
        .set(authenticate(reader))
        .send({ name: 'Renamed' })
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/characters/${characterId}`)
        .set(authenticate(reader))
        .expect(404);
    }

    await request(app.getHttpServer())
      .patch(`/characters/${characterId}`)
      .set(authenticate(player))
      .send({ name: 'Alex Berg', data: { ...characterData, age: 16 } })
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          name: 'Alex Berg',
          data: { age: 16 },
        }),
      );
    await request(app.getHttpServer())
      .patch(`/characters/${characterId}`)
      .set(authenticate(player))
      .send({ data: { ...characterData, age: 99 } })
      .expect(400);

    // Retiring the active character frees the slot for a new one.
    await request(app.getHttpServer())
      .patch(`/characters/${characterId}`)
      .set(authenticate(player))
      .send({ isActive: false })
      .expect(200);
    const replacement = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/characters`)
      .set(authenticate(player))
      .send({ name: 'Kim', data: characterData })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/characters/${characterId}`)
      .set(authenticate(player))
      .send({ isActive: true })
      .expect(409);

    await request(app.getHttpServer())
      .delete(`/characters/${replacement.body.characterId}`)
      .set(authenticate(player))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/characters/${replacement.body.characterId}`)
      .set(authenticate(owner))
      .expect(404);

    // A player demoted to viewer keeps the sheet readable but not editable.
    const playerProfile = await request(app.getHttpServer())
      .get('/auth/me')
      .set(authenticate(player))
      .expect(200);
    await request(app.getHttpServer())
      .patch(
        `/campaigns/${campaign.campaignId}/members/${playerProfile.body.userId}`,
      )
      .set(authenticate(owner))
      .send({ role: 'VIEWER' })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/characters/${characterId}`)
      .set(authenticate(player))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/characters/${characterId}`)
      .set(authenticate(player))
      .send({ name: 'Still mine?' })
      .expect(404);
  });

  it('validates data against the campaign game system', async () => {
    const owner = await registerUser(app, 'owner@loopkeeper.dev', 'Owner');
    const player = await registerUser(app, 'player@loopkeeper.dev', 'Player');
    const campaign = await createCampaign(app, owner);

    await inviteAndAccept(app, owner, player, campaign.campaignId, 'PLAYER');

    await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/characters`)
      .set(authenticate(player))
      .send({
        name: 'Invalid character',

        data: { ...characterData, age: 25, unexpected: true },
      })
      .expect(400);

    // Age and type are the only required fields; the rest comes later.
    await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/characters`)
      .set(authenticate(player))
      .send({ name: 'No type', data: { age: 12 } })
      .expect(400);
    const minimal = await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/characters`)
      .set(authenticate(player))
      .send({ name: 'Maja', data: { age: 12, type: 'BOOKWORM' } })
      .expect(201);
    expect(minimal.body.owner).toEqual({
      userId: minimal.body.ownerId,
      name: 'Player',
    });
    expect(minimal.body).not.toHaveProperty('templateId');
    for (const invalid of [
      { age: 12, type: 'UNKNOWN' },
      { age: 12, type: 'BOOKWORM', broken: 'yes' },
      { age: 12, type: 'BOOKWORM', body: 6 },
      { age: 12, type: 'BOOKWORM', drive: 'x'.repeat(501) },
      { age: 12, type: 'BOOKWORM', unexpected: true },
    ]) {
      const result = await request(app.getHttpServer())
        .patch(`/characters/${minimal.body.characterId}`)
        .set(authenticate(player))
        .send({ data: invalid })
        .expect(400);
      expect(result.body.code).toBe('validation.failed');
    }
    const unchanged = await request(app.getHttpServer())
      .get(`/characters/${minimal.body.characterId}`)
      .set(authenticate(player))
      .expect(200);
    expect(unchanged.body.data).toEqual({ age: 12, type: 'BOOKWORM' });

    await request(app.getHttpServer())
      .post(`/campaigns/${campaign.campaignId}/characters`)
      .set(authenticate(player))
      .send({
        name: 'Legacy template field',
        templateId: '11111111-1111-4111-8111-111111111111',

        data: characterData,
      })
      .expect(400);
  });
});
