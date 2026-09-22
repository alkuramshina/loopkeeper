import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { closeTestDatabase, resetTestDatabase } from './helpers/database';

type User = { accessToken: string; email: string };
const password = 'test-password-123';

async function register(app: INestApplication, email: string): Promise<User> {
  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password, name: email })
    .expect(201);
  return { accessToken: response.body.accessToken, email };
}
const auth = (user: User) => ({ Authorization: `Bearer ${user.accessToken}` });

async function campaign(app: INestApplication, owner: User, title: string) {
  const response = await request(app.getHttpServer())
    .post('/campaigns')
    .set(auth(owner))
    .send({ title, description: title })
    .expect(201);
  return response.body.campaignId as string;
}

describe('Investigation board (e2e)', () => {
  let app: INestApplication;
  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });
  afterEach(async () => app.close());
  afterAll(async () => closeTestDatabase());

  it('is collaborative for owner and players while isolating other users and campaigns', async () => {
    const owner = await register(app, 'owner@loopkeeper.dev');
    const player = await register(app, 'player@loopkeeper.dev');
    const viewer = await register(app, 'viewer@loopkeeper.dev');
    const outsider = await register(app, 'outsider@loopkeeper.dev');
    const campaignId = await campaign(app, owner, 'Mystery');
    const otherCampaignId = await campaign(app, owner, 'Other mystery');

    for (const [user, role] of [
      [player, 'PLAYER'],
      [viewer, 'VIEWER'],
    ] as const) {
      await request(app.getHttpServer())
        .post(`/campaigns/${campaignId}/members`)
        .set(auth(owner))
        .send({ email: user.email, role })
        .expect(201);
    }

    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/investigation-board`)
      .set(auth(viewer))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/investigation-board`)
      .set(auth(outsider))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/investigation-board`)
      .set(auth(owner))
      .expect(200)
      .expect((response) => expect(response.body.cards).toEqual([]));

    const playerCard = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/investigation-cards`)
      .set(auth(player))
      .send({
        title: 'The old factory',
        content: 'Saw lights at night.',
        tags: ['location', 'lead'],
        color: '#2f80ed',
        icon: 'factory',
      })
      .expect(201);
    expect(playerCard.body.node).toMatchObject({
      x: 0,
      y: 0,
      width: 240,
      height: 160,
    });

    await request(app.getHttpServer())
      .patch(`/investigation-board/nodes/${playerCard.body.cardId}`)
      .set(auth(player))
      .send({ x: 120, y: -40, width: 320, height: 180 })
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          x: 120,
          y: -40,
          width: 320,
          height: 180,
        }),
      );

    const ownerCard = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/investigation-cards`)
      .set(auth(owner))
      .send({ title: 'Strange signal' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/investigation-cards/${ownerCard.body.cardId}`)
      .set(auth(player))
      .send({ content: 'The player can add a hypothesis.' })
      .expect(200);

    const link = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/investigation-links`)
      .set(auth(player))
      .send({
        cardAId: ownerCard.body.cardId,
        cardBId: playerCard.body.cardId,
        label: 'heard near',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/investigation-links`)
      .set(auth(owner))
      .send({ cardAId: playerCard.body.cardId, cardBId: ownerCard.body.cardId })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/investigation-links`)
      .set(auth(owner))
      .send({
        cardAId: playerCard.body.cardId,
        cardBId: playerCard.body.cardId,
      })
      .expect(400);

    const otherCard = await request(app.getHttpServer())
      .post(`/campaigns/${otherCampaignId}/investigation-cards`)
      .set(auth(owner))
      .send({ title: 'Other tenant card' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/investigation-links`)
      .set(auth(player))
      .send({ cardAId: playerCard.body.cardId, cardBId: otherCard.body.cardId })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/investigation-cards/${playerCard.body.cardId}`)
      .set(auth(viewer))
      .send({ title: 'No access' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/investigation-cards/${ownerCard.body.cardId}`)
      .set(auth(player))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/investigation-board`)
      .set(auth(player))
      .expect(200)
      .expect((response) => {
        expect(response.body.cards).toHaveLength(1);
        expect(response.body.links).toEqual([]);
        expect(response.body.cards[0].node).toMatchObject({ x: 120, y: -40 });
      });
    expect(link.body.linkId).toBeDefined();
  });
});
