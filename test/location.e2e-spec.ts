import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { closeTestDatabase, resetTestDatabase } from './helpers/database';

type AuthenticatedUser = { accessToken: string; email: string };

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

describe('Campaign locations (e2e)', () => {
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

  it('allows owners to manage locations and lists them by sort order then creation', async () => {
    const owner = await registerUser(app, 'owner@loopkeeper.dev', 'Owner');
    const campaign = await request(app.getHttpServer())
      .post('/campaigns')
      .set(authenticate(owner))
      .send({ title: 'Mystery', description: 'A strange investigation' })
      .expect(201);
    const campaignId = campaign.body.campaignId;

    const second = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/locations`)
      .set(authenticate(owner))
      .send({ title: 'Second', sortOrder: 2 })
      .expect(201);
    const first = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/locations`)
      .set(authenticate(owner))
      .send({
        title: 'First',
        description: 'A safe house',
        imageUrl: 'https://example.com/safe-house.png',
        sortOrder: 1,
      })
      .expect(201);
    const anotherFirst = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/locations`)
      .set(authenticate(owner))
      .send({ title: 'Another first', sortOrder: 1 })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/locations`)
      .set(authenticate(owner))
      .expect(200)
      .expect((response) =>
        expect(
          response.body.map(
            (location: { locationId: string }) => location.locationId,
          ),
        ).toEqual([
          first.body.locationId,
          anotherFirst.body.locationId,
          second.body.locationId,
        ]),
      );

    await request(app.getHttpServer())
      .patch(`/locations/${first.body.locationId}`)
      .set(authenticate(owner))
      .send({ title: 'Updated safe house', sortOrder: 0 })
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          title: 'Updated safe house',
          sortOrder: 0,
        }),
      );

    await request(app.getHttpServer())
      .get(`/locations/${first.body.locationId}`)
      .set(authenticate(owner))
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          locationId: first.body.locationId,
        }),
      );

    await request(app.getHttpServer())
      .delete(`/locations/${first.body.locationId}`)
      .set(authenticate(owner))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/locations/${first.body.locationId}`)
      .set(authenticate(owner))
      .expect(404);
  });

  it('allows players to list and read but returns neutral 404s to viewers and outsiders', async () => {
    const owner = await registerUser(app, 'owner@loopkeeper.dev', 'Owner');
    const player = await registerUser(app, 'player@loopkeeper.dev', 'Player');
    const viewer = await registerUser(app, 'viewer@loopkeeper.dev', 'Viewer');
    const outsider = await registerUser(
      app,
      'outsider@loopkeeper.dev',
      'Outsider',
    );
    const campaign = await request(app.getHttpServer())
      .post('/campaigns')
      .set(authenticate(owner))
      .send({ title: 'Mystery', description: 'A strange investigation' })
      .expect(201);
    const campaignId = campaign.body.campaignId;

    for (const [user, role] of [
      [player, 'PLAYER'],
      [viewer, 'VIEWER'],
    ] as const) {
      await inviteAndAccept(app, owner, user, campaignId, role);
    }

    const location = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/locations`)
      .set(authenticate(owner))
      .send({ title: 'School' })
      .expect(201);

    for (const user of [player]) {
      await request(app.getHttpServer())
        .get(`/campaigns/${campaignId}/locations`)
        .set(authenticate(user))
        .expect(200);
      await request(app.getHttpServer())
        .get(`/locations/${location.body.locationId}`)
        .set(authenticate(user))
        .expect(200);
    }

    for (const user of [viewer, outsider]) {
      await request(app.getHttpServer())
        .get(`/campaigns/${campaignId}/locations`)
        .set(authenticate(user))
        .expect(404);
      await request(app.getHttpServer())
        .get(`/locations/${location.body.locationId}`)
        .set(authenticate(user))
        .expect(404);
      await request(app.getHttpServer())
        .patch(`/locations/${location.body.locationId}`)
        .set(authenticate(user))
        .send({ title: 'Not allowed' })
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/locations/${location.body.locationId}`)
        .set(authenticate(user))
        .expect(404);
    }
  });

  it('validates location fields', async () => {
    const owner = await registerUser(app, 'owner@loopkeeper.dev', 'Owner');
    const campaign = await request(app.getHttpServer())
      .post('/campaigns')
      .set(authenticate(owner))
      .send({ title: 'Mystery', description: 'A strange investigation' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/campaigns/${campaign.body.campaignId}/locations`)
      .set(authenticate(owner))
      .send({
        title: 'x'.repeat(201),
        description: 'x'.repeat(10001),
        imageUrl: 'http://example.com/location.png',
        sortOrder: -1,
      })
      .expect(400);
  });
});
