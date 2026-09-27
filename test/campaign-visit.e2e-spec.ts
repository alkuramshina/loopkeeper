import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import {
  closeTestDatabase,
  getTestPrisma,
  resetTestDatabase,
} from './helpers/database';

type Headers = { Authorization: string };
const password = 'test-password-123';

describe('Campaign visits (e2e)', () => {
  let app: INestApplication;
  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });
  afterEach(async () => app.close());
  afterAll(async () => closeTestDatabase());

  async function register(name: string): Promise<Headers> {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `${name}@example.test`, name, password })
      .expect(201);
    return { Authorization: `Bearer ${response.body.accessToken}` };
  }

  async function invite(
    owner: Headers,
    member: Headers,
    campaignId: string,
    role: 'PLAYER' | 'VIEWER',
  ) {
    const invitation = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/invitations`)
      .set(owner)
      .send({ role })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/invitations/${invitation.body.token}/accept`)
      .set(member)
      .expect(201);
  }

  it('tracks only visible material opened since each member’s previous visit', async () => {
    const owner = await register('owner');
    const player = await register('player');
    const viewer = await register('viewer');
    const outsider = await register('outsider');
    const campaign = await request(app.getHttpServer())
      .post('/campaigns')
      .set(owner)
      .send({ title: 'Mystery', description: 'An investigation' })
      .expect(201);
    const id: string = campaign.body.campaignId;
    await invite(owner, player, id, 'PLAYER');
    await invite(owner, viewer, id, 'VIEWER');

    await request(app.getHttpServer())
      .post(`/campaigns/${id}/visit`)
      .set(outsider)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/campaigns/${id}/visit`)
      .set(viewer)
      .expect(200)
      .expect({ newSinceAt: null });
    const first = await request(app.getHttpServer())
      .post(`/campaigns/${id}/visit`)
      .set(player)
      .expect(200);
    expect(first.body.newSinceAt).toBeNull();
    await request(app.getHttpServer())
      .post(`/campaigns/${id}/visit`)
      .set(player)
      .expect(200)
      .expect({ newSinceAt: null });
    const member = await getTestPrisma().campaignMember.findFirstOrThrow({
      where: { campaignId: id, user: { email: 'player@example.test' } },
    });
    const oldVisit = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await getTestPrisma().campaignParticipantState.update({
      where: { memberId: member.memberId },
      data: { lastVisitAt: oldVisit },
    });
    const next = await request(app.getHttpServer())
      .post(`/campaigns/${id}/visit`)
      .set(player)
      .expect(200);
    expect(new Date(next.body.newSinceAt).getTime()).toBe(oldVisit.getTime());

    const material = await request(app.getHttpServer())
      .post(`/campaigns/${id}/elements`)
      .set(owner)
      .send({ type: 'NOTE', title: 'Clue' })
      .expect(201);
    expect(material.body.sharedAt).toBeNull();
    await request(app.getHttpServer())
      .patch(`/elements/${material.body.elementId}/access`)
      .set(owner)
      .send({ access: 'SHARED' })
      .expect(200)
      .expect((response) => expect(response.body.sharedAt).not.toBeNull());
    const campaignForPlayer = await request(app.getHttpServer())
      .get(`/campaigns/${id}`)
      .set(player)
      .expect(200);
    expect(campaignForPlayer.body.newVisibleMaterialCount).toBe(1);
    expect(campaignForPlayer.body.newSinceAt).toBe(next.body.newSinceAt);
    const list = await request(app.getHttpServer())
      .get('/campaigns')
      .set(player)
      .expect(200);
    expect(list.body[0].newVisibleMaterialCount).toBe(1);
    await request(app.getHttpServer())
      .get(`/campaigns/${id}`)
      .set(owner)
      .expect(200)
      .expect((response) =>
        expect(response.body.newVisibleMaterialCount).toBe(0),
      );

    const reopened = await request(app.getHttpServer())
      .patch(`/elements/${material.body.elementId}/access`)
      .set(owner)
      .send({ access: 'SHARED' })
      .expect(200);
    expect(reopened.body.sharedAt).not.toBe(material.body.sharedAt);
    await request(app.getHttpServer())
      .get(`/campaigns/${id}`)
      .set(player)
      .expect(200)
      .expect((response) =>
        expect(response.body.newVisibleMaterialCount).toBe(1),
      );

    const own = await request(app.getHttpServer())
      .post(`/campaigns/${id}/elements`)
      .set(player)
      .send({ type: 'NOTE', title: 'Own', access: 'SHARED' })
      .expect(201);
    expect(own.body.sharedAt).not.toBeNull();
    await request(app.getHttpServer())
      .get(`/campaigns/${id}`)
      .set(player)
      .expect(200)
      .expect((response) =>
        expect(response.body.newVisibleMaterialCount).toBe(1),
      );

    const ownCard = await request(app.getHttpServer())
      .post(`/campaigns/${id}/cards`)
      .set(player)
      .send({ title: 'My card' })
      .expect(201);
    const otherCard = await request(app.getHttpServer())
      .post(`/campaigns/${id}/cards`)
      .set(owner)
      .send({ title: 'Other card' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/campaigns/${id}/investigation-links`)
      .set(owner)
      .send({ cardAId: ownCard.body.cardId, cardBId: otherCard.body.cardId })
      .expect(201);
    const board = await request(app.getHttpServer())
      .get(`/campaigns/${id}/investigation-board`)
      .set(player)
      .expect(200);
    expect(board.body.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cardId: ownCard.body.cardId,
          createdById: ownCard.body.createdById,
        }),
        expect.objectContaining({
          cardId: otherCard.body.cardId,
          createdById: otherCard.body.createdById,
        }),
      ]),
    );
    expect(ownCard.body.createdById).not.toBe(otherCard.body.createdById);
    expect(board.body.links[0]).toMatchObject({
      createdById: otherCard.body.createdById,
    });

    await request(app.getHttpServer())
      .patch(`/elements/${material.body.elementId}/access`)
      .set(owner)
      .send({ access: 'MASTER_ONLY' })
      .expect(200)
      .expect((response) => expect(response.body.sharedAt).toBeNull());
    await request(app.getHttpServer())
      .get(`/elements/${material.body.elementId}`)
      .set(player)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/elements/${material.body.elementId}`)
      .set(viewer)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/campaigns/${id}`)
      .set(player)
      .expect(200)
      .expect((response) =>
        expect(response.body.newVisibleMaterialCount).toBe(0),
      );
  });
});
