import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { closeTestDatabase, resetTestDatabase } from './helpers/database';

const password = 'test-password-123';
const backgroundId = 'c8aaf3ce-97ce-4e2d-a127-dc4bacb1d2b7';
const otherBackgroundId = 'd9bbf4df-a8df-4f3e-b238-ed5cbdc2e3c8';

type AuthenticatedUser = { accessToken: string; email: string };

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

function settings(selectionMode: 'FIXED' | 'RANDOM' = 'FIXED') {
  return {
    selectionMode,
    fixedBackgroundId: selectionMode === 'FIXED' ? backgroundId : null,
    backgrounds: [
      {
        backgroundId,
        name: 'The Flooded Basement',
        imageUrl: 'https://example.com/flooded-basement.jpg',
        isEnabled: true,
        sortOrder: 0,
      },
      {
        backgroundId: otherBackgroundId,
        name: 'The Schoolyard',
        imageUrl: 'https://example.com/schoolyard.jpg',
        isEnabled: false,
        sortOrder: 1,
      },
    ],
  };
}

describe('Campaign background settings (e2e)', () => {
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

  it('lets an owner update settings and exposes enabled candidates to players only', async () => {
    const owner = await registerUser(app, 'owner@loopkeeper.dev', 'Owner');
    const player = await registerUser(app, 'player@loopkeeper.dev', 'Player');
    const viewer = await registerUser(app, 'viewer@loopkeeper.dev', 'Viewer');
    const campaign = await request(app.getHttpServer())
      .post('/campaigns')
      .set(authenticate(owner))
      .send({ title: 'Mystery', description: 'A strange investigation' })
      .expect(201);
    const campaignId = campaign.body.campaignId;

    const saved = await request(app.getHttpServer())
      .patch(`/campaigns/${campaignId}/background-settings`)
      .set(authenticate(owner))
      .send(settings())
      .expect(200);
    expect(saved.body).toEqual(settings());

    await inviteAndAccept(app, owner, player, campaignId, 'PLAYER');
    await inviteAndAccept(app, owner, viewer, campaignId, 'VIEWER');

    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}`)
      .set(authenticate(player))
      .expect(200)
      .expect((response) => {
        expect(response.body.backgroundConfig).toEqual({
          selectionMode: 'FIXED',
          fixedBackgroundId: backgroundId,
          backgrounds: [settings().backgrounds[0]],
        });
      });

    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}`)
      .set(authenticate(viewer))
      .expect(200)
      .expect((response) => {
        expect(response.body).not.toHaveProperty('backgroundConfig');
      });

    for (const method of ['get', 'patch'] as const) {
      const testRequest = request(app.getHttpServer())
        [method](`/campaigns/${campaignId}/background-settings`)
        .set(authenticate(player));
      if (method === 'patch') testRequest.send(settings('RANDOM'));
      await testRequest.expect(404);
    }
  });

  it('rejects invalid background configurations', async () => {
    const owner = await registerUser(app, 'owner@loopkeeper.dev', 'Owner');
    const campaign = await request(app.getHttpServer())
      .post('/campaigns')
      .set(authenticate(owner))
      .send({ title: 'Mystery', description: 'A strange investigation' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/campaigns/${campaign.body.campaignId}/background-settings`)
      .set(authenticate(owner))
      .send({ ...settings(), fixedBackgroundId: otherBackgroundId })
      .expect(400)
      .expect({
        statusCode: 400,
        code: 'campaign.background_settings.invalid',
        message: 'The fixed background must exist and be enabled',
        violations: [{ field: 'fixedBackgroundId', code: 'invalid' }],
      });

    await request(app.getHttpServer())
      .patch(`/campaigns/${campaign.body.campaignId}/background-settings`)
      .set(authenticate(owner))
      .send({ ...settings('RANDOM'), fixedBackgroundId: backgroundId })
      .expect(400)
      .expect({
        statusCode: 400,
        code: 'campaign.background_settings.invalid',
        message: 'A random background selection cannot have a fixed background',
        violations: [{ field: 'fixedBackgroundId', code: 'invalid' }],
      });

    await request(app.getHttpServer())
      .patch(`/campaigns/${campaign.body.campaignId}/background-settings`)
      .set(authenticate(owner))
      .send({
        ...settings('RANDOM'),
        backgrounds: [settings().backgrounds[0], settings().backgrounds[0]],
      })
      .expect(400)
      .expect({
        statusCode: 400,
        code: 'campaign.background_settings.invalid',
        message: 'Background IDs must be unique',
        violations: [{ field: 'backgrounds', code: 'invalid' }],
      });
  });
});
