import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { closeTestDatabase, resetTestDatabase } from './helpers/database';

const password = 'test-password-123';

type Headers = { Authorization: string };

describe('Campaign elements (e2e)', () => {
  let app: INestApplication;
  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });
  afterEach(async () => app.close());
  afterAll(async () => closeTestDatabase());

  async function register(email: string): Promise<Headers> {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: email })
      .expect(201);
    return { Authorization: `Bearer ${response.body.accessToken}` };
  }

  async function setupCampaign() {
    const owner = await register('owner@loopkeeper.dev');
    const player = await register('player@loopkeeper.dev');
    const otherPlayer = await register('other-player@loopkeeper.dev');
    const viewer = await register('viewer@loopkeeper.dev');
    const outsider = await register('outsider@loopkeeper.dev');
    const campaign = await request(app.getHttpServer())
      .post('/campaigns')
      .set(owner)
      .send({ title: 'Mystery', description: 'A campaign' })
      .expect(201);
    const campaignId: string = campaign.body.campaignId;
    for (const [user, role] of [
      [player, 'PLAYER'],
      [otherPlayer, 'PLAYER'],
      [viewer, 'VIEWER'],
    ] as const) {
      const invitation = await request(app.getHttpServer())
        .post(`/campaigns/${campaignId}/invitations`)
        .set(owner)
        .send({ role })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/invitations/${invitation.body.token}/accept`)
        .set(user)
        .expect(201);
    }
    return { owner, player, otherPlayer, viewer, outsider, campaignId };
  }

  function canRead(user: Headers, elementId: string, expected: boolean) {
    return request(app.getHttpServer())
      .get(`/elements/${elementId}`)
      .set(user)
      .expect(expected ? 200 : 404);
  }

  async function listIds(user: Headers, campaignId: string) {
    const response = await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/elements`)
      .set(user)
      .expect(200);
    return (response.body as { elementId: string }[]).map(
      (element) => element.elementId,
    );
  }

  it('limits master materials to the owner and shared reads to members, including viewers', async () => {
    const { owner, player, viewer, outsider, campaignId } =
      await setupCampaign();

    for (const type of ['NOTE', 'LOCATION', 'NPC', 'OTHER']) {
      const body = {
        type,
        title: type,
        content: '# Markdown',
        ...(type === 'NPC'
          ? { typeData: { role: 'Technician', secret: 'Knows the truth' } }
          : {}),
        ...(type === 'LOCATION'
          ? { imageUrl: 'https://example.com/map.png' }
          : {}),
      };
      const created = await request(app.getHttpServer())
        .post(`/campaigns/${campaignId}/elements`)
        .set(owner)
        .send(body)
        .expect(201);
      const id = created.body.elementId;
      expect(created.body.access).toBe('MASTER_ONLY');
      expect(created.body.createdBy).toEqual({
        userId: created.body.createdById,
        name: 'owner@loopkeeper.dev',
      });
      await canRead(player, id, false);
      await canRead(viewer, id, false);
      await request(app.getHttpServer())
        .patch(`/elements/${id}`)
        .set(player)
        .send({ title: 'Stolen' })
        .expect(404);
      await request(app.getHttpServer())
        .patch(`/elements/${id}/access`)
        .set(player)
        .send({ access: 'SHARED' })
        .expect(404);
      await request(app.getHttpServer())
        .patch(`/elements/${id}/access`)
        .set(owner)
        .send({ access: 'SHARED' })
        .expect(200)
        .expect((response) => expect(response.body.access).toBe('SHARED'));
      await canRead(player, id, true);
      await canRead(viewer, id, true);
      await canRead(outsider, id, false);
      await request(app.getHttpServer())
        .patch(`/elements/${id}/access`)
        .set(owner)
        .send({ access: 'MASTER_ONLY' })
        .expect(200)
        .expect((response) => expect(response.body.access).toBe('MASTER_ONLY'));
      await canRead(viewer, id, false);
      await request(app.getHttpServer())
        .delete(`/elements/${id}`)
        .set(player)
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/elements/${id}`)
        .set(owner)
        .expect(200);
    }
    expect(await listIds(player, campaignId)).toHaveLength(0);
    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/elements`)
      .set(outsider)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/elements`)
      .set(owner)
      .send({
        type: 'NPC',
        title: 'Invalid',
        typeData: { role: 'Technician', unexpected: true },
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/elements`)
      .set(owner)
      .send({ type: 'OTHER', title: 'Private', access: 'PRIVATE' })
      .expect(400);
    const material = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/elements`)
      .set(owner)
      .send({ type: 'OTHER', title: 'Material' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/elements/${material.body.elementId}/access`)
      .set(owner)
      .send({ access: 'PRIVATE' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/elements/${material.body.elementId}`)
      .set(owner)
      .send({ access: 'SHARED' })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/notes`)
      .set(owner)
      .expect(404);
  });

  it('lets players keep their own notes on every access level', async () => {
    const { owner, player, otherPlayer, viewer, outsider, campaignId } =
      await setupCampaign();

    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/elements`)
      .set(player)
      .send({ type: 'NPC', title: 'No', typeData: { role: 'Spy' } })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/elements`)
      .set(viewer)
      .send({ type: 'NOTE', title: 'No' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/elements`)
      .set(outsider)
      .send({ type: 'NOTE', title: 'No' })
      .expect(404);

    const created = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/elements`)
      .set(player)
      .send({ type: 'NOTE', title: 'Clue', content: 'The tower hums' })
      .expect(201);
    const id: string = created.body.elementId;
    expect(created.body.access).toBe('PRIVATE');
    expect(created.body.createdBy.name).toBe('player@loopkeeper.dev');

    // PRIVATE: author only; the master does not see it either.
    await canRead(player, id, true);
    await canRead(owner, id, false);
    await canRead(otherPlayer, id, false);
    await canRead(viewer, id, false);
    expect(await listIds(player, campaignId)).toEqual([id]);
    expect(await listIds(owner, campaignId)).toEqual([]);

    // MASTER_ONLY: author and master.
    await request(app.getHttpServer())
      .patch(`/elements/${id}/access`)
      .set(player)
      .send({ access: 'MASTER_ONLY' })
      .expect(200);
    await canRead(owner, id, true);
    await canRead(otherPlayer, id, false);
    await canRead(viewer, id, false);
    expect(await listIds(owner, campaignId)).toEqual([id]);
    expect(await listIds(otherPlayer, campaignId)).toEqual([]);

    // The master reads but never edits, deletes or re-shares a player's note.
    await request(app.getHttpServer())
      .patch(`/elements/${id}`)
      .set(owner)
      .send({ title: 'Edited' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/elements/${id}/access`)
      .set(owner)
      .send({ access: 'SHARED' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/elements/${id}`)
      .set(owner)
      .expect(404);

    // SHARED: every member reads; only the author writes.
    await request(app.getHttpServer())
      .patch(`/elements/${id}/access`)
      .set(player)
      .send({ access: 'SHARED' })
      .expect(200);
    await canRead(owner, id, true);
    await canRead(otherPlayer, id, true);
    await canRead(viewer, id, true);
    await canRead(outsider, id, false);
    await request(app.getHttpServer())
      .patch(`/elements/${id}`)
      .set(otherPlayer)
      .send({ title: 'Edited' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/elements/${id}`)
      .set(player)
      .send({ title: 'Clue, revised' })
      .expect(200)
      .expect((response) => expect(response.body.title).toBe('Clue, revised'));

    // A shared player note can go on the board; leaving SHARED removes it.
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(otherPlayer)
      .send({ cardKind: 'ELEMENT_REFERENCE', elementId: id })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/elements/${id}/access`)
      .set(player)
      .send({ access: 'PRIVATE' })
      .expect(200);
    const board = await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/investigation-board`)
      .set(owner)
      .expect(200);
    expect(board.body.cards).toHaveLength(0);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(player)
      .send({ cardKind: 'ELEMENT_REFERENCE', elementId: id })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/elements/${id}`)
      .set(player)
      .expect(200);
    await canRead(player, id, false);
  });

  it('revokes author rights when the player is demoted to viewer', async () => {
    const { owner, player, campaignId } = await setupCampaign();
    const created = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/elements`)
      .set(player)
      .send({ type: 'NOTE', title: 'Mine' })
      .expect(201);
    const id: string = created.body.elementId;
    await request(app.getHttpServer())
      .patch(`/campaigns/${campaignId}/members/${created.body.createdById}`)
      .set(owner)
      .send({ role: 'VIEWER' })
      .expect(200);
    await canRead(player, id, false);
    await request(app.getHttpServer())
      .patch(`/elements/${id}`)
      .set(player)
      .send({ title: 'Still mine?' })
      .expect(404);
  });
});
