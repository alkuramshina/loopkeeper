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

function createNote(
  app: INestApplication,
  user: AuthenticatedUser,
  campaignId: string,
  visibility: string,
  title = visibility,
) {
  return request(app.getHttpServer())
    .post(`/campaigns/${campaignId}/notes`)
    .set(authenticate(user))
    .send({ title, content: `${title} content`, visibility });
}

describe('Notes visibility (e2e)', () => {
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

  it('applies the same visibility policy to lists and individual notes', async () => {
    const owner = await registerUser(app, 'owner@loopkeeper.dev', 'Owner');
    const player = await registerUser(app, 'player@loopkeeper.dev', 'Player');
    const anotherPlayer = await registerUser(
      app,
      'another@loopkeeper.dev',
      'Another',
    );
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
      [anotherPlayer, 'PLAYER'],
      [viewer, 'VIEWER'],
    ] as const) {
      await request(app.getHttpServer())
        .post(`/campaigns/${campaignId}/members`)
        .set(authenticate(owner))
        .send({ email: user.email, role })
        .expect(201);
    }

    const ownerPrivate = await createNote(
      app,
      owner,
      campaignId,
      'PRIVATE',
    ).expect(201);
    const masterOnly = await createNote(
      app,
      owner,
      campaignId,
      'MASTER_ONLY',
    ).expect(201);
    const players = await createNote(app, owner, campaignId, 'PLAYERS').expect(
      201,
    );
    const publicNote = await createNote(
      app,
      owner,
      campaignId,
      'PUBLIC',
    ).expect(201);
    const playerPrivate = await createNote(
      app,
      player,
      campaignId,
      'PRIVATE',
    ).expect(201);

    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/notes`)
      .set(authenticate(owner))
      .expect(200)
      .expect((response) => expect(response.body).toHaveLength(4));

    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/notes`)
      .set(authenticate(player))
      .expect(200)
      .expect((response) => expect(response.body).toHaveLength(3));

    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/notes`)
      .set(authenticate(viewer))
      .expect(200)
      .expect((response) => expect(response.body).toHaveLength(1));

    for (const note of [ownerPrivate, masterOnly, playerPrivate]) {
      await request(app.getHttpServer())
        .get(`/notes/${note.body.noteId}`)
        .set(authenticate(anotherPlayer))
        .expect(404);
    }

    await request(app.getHttpServer())
      .get(`/notes/${players.body.noteId}`)
      .set(authenticate(player))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/notes/${publicNote.body.noteId}`)
      .set(authenticate(viewer))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/notes/${publicNote.body.noteId}`)
      .set(authenticate(outsider))
      .expect(404);
  });

  it('limits writing to owners and note authors', async () => {
    const owner = await registerUser(app, 'owner@loopkeeper.dev', 'Owner');
    const player = await registerUser(app, 'player@loopkeeper.dev', 'Player');
    const viewer = await registerUser(app, 'viewer@loopkeeper.dev', 'Viewer');
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
      await request(app.getHttpServer())
        .post(`/campaigns/${campaignId}/members`)
        .set(authenticate(owner))
        .send({ email: user.email, role })
        .expect(201);
    }

    const ownerPublic = await createNote(
      app,
      owner,
      campaignId,
      'PUBLIC',
    ).expect(201);
    const playerNote = await createNote(
      app,
      player,
      campaignId,
      'PLAYERS',
    ).expect(201);

    await createNote(app, player, campaignId, 'MASTER_ONLY').expect(403);
    await createNote(app, viewer, campaignId, 'PUBLIC').expect(403);

    await request(app.getHttpServer())
      .patch(`/notes/${ownerPublic.body.noteId}`)
      .set(authenticate(player))
      .send({ title: 'Not allowed' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/notes/${playerNote.body.noteId}`)
      .set(authenticate(player))
      .send({ title: 'Player update' })
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({ title: 'Player update' }),
      );

    await request(app.getHttpServer())
      .delete(`/notes/${playerNote.body.noteId}`)
      .set(authenticate(owner))
      .expect(200);
  });
});
