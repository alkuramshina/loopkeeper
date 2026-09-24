import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { closeTestDatabase, resetTestDatabase } from './helpers/database';

type AuthenticatedUser = {
  accessToken: string;
  email: string;
};

const password = 'test-password-123';

async function registerUser(
  app: INestApplication,
  email: string,
  name: string,
): Promise<AuthenticatedUser> {
  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, name, password })
    .expect(201);

  return {
    accessToken: response.body.accessToken,
    email,
  };
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

describe('Campaign tenant access (e2e)', () => {
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

  it('limits campaign visibility and management to its tenant', async () => {
    const owner = await registerUser(app, 'owner@loopkeeper.dev', 'Owner');
    const player = await registerUser(app, 'player@loopkeeper.dev', 'Player');
    const outsider = await registerUser(
      app,
      'outsider@loopkeeper.dev',
      'Outsider',
    );

    const campaignResponse = await request(app.getHttpServer())
      .post('/campaigns')
      .set(authenticate(owner))
      .send({ title: 'Mystery', description: 'A strange investigation' })
      .expect(201);
    const campaignId = campaignResponse.body.campaignId;

    await request(app.getHttpServer())
      .get('/campaigns')
      .set(authenticate(outsider))
      .expect(200)
      .expect([]);

    for (const method of ['get', 'patch', 'delete'] as const) {
      const testRequest = request(app.getHttpServer())
        [method](`/campaigns/${campaignId}`)
        .set(authenticate(outsider));
      if (method === 'patch') {
        testRequest.send({ title: 'Not allowed' });
      }
      await testRequest.expect(404);
    }

    await inviteAndAccept(app, owner, player, campaignId, 'PLAYER');

    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}`)
      .set(authenticate(player))
      .expect(200)
      .expect((response) => {
        const { currentUserRole: _ownerRole, ...ownerCampaign } =
          campaignResponse.body;
        expect(response.body).toEqual({
          ...ownerCampaign,
          currentUserRole: 'PLAYER',
        });
      });

    await request(app.getHttpServer())
      .patch(`/campaigns/${campaignId}`)
      .set(authenticate(player))
      .send({ title: 'Not allowed' })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/members`)
      .set(authenticate(player))
      .expect(404);
  });

  it('accepts an invitation once and rejects revoked invitations', async () => {
    const owner = await registerUser(app, 'owner@loopkeeper.dev', 'Owner');
    const invited = await registerUser(
      app,
      'invited@loopkeeper.dev',
      'Invited',
    );
    const revokedUser = await registerUser(
      app,
      'revoked@loopkeeper.dev',
      'Revoked',
    );

    const campaignResponse = await request(app.getHttpServer())
      .post('/campaigns')
      .set(authenticate(owner))
      .send({ title: 'Mystery', description: 'A strange investigation' })
      .expect(201);
    const campaignId = campaignResponse.body.campaignId;

    const invitationResponse = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/invitations`)
      .set(authenticate(owner))
      .send({ role: 'VIEWER' })
      .expect(201);

    expect(invitationResponse.body).toHaveProperty('token');
    expect(invitationResponse.body).not.toHaveProperty('tokenHash');

    await request(app.getHttpServer())
      .post(`/invitations/${invitationResponse.body.token}/accept`)
      .set(authenticate(invited))
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({
          campaignId,
          campaignRole: 'VIEWER',
        });
      });

    await request(app.getHttpServer())
      .post(`/invitations/${invitationResponse.body.token}/accept`)
      .set(authenticate(invited))
      .expect(404);

    const revokedInvitation = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/invitations`)
      .set(authenticate(owner))
      .send({ role: 'PLAYER' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(
        `/campaigns/${campaignId}/invitations/${revokedInvitation.body.invitationId}`,
      )
      .set(authenticate(owner))
      .expect(200);

    await request(app.getHttpServer())
      .post(`/invitations/${revokedInvitation.body.token}/accept`)
      .set(authenticate(revokedUser))
      .expect(404);
  });
});
