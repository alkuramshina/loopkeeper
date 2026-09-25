import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { closeTestDatabase, resetTestDatabase } from './helpers/database';

const password = 'test-password-123';

describe('Campaign elements (e2e)', () => {
  let app: INestApplication;
  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });
  afterEach(async () => app.close());
  afterAll(async () => closeTestDatabase());

  it('limits writes to the owner and shared reads to members, including viewers', async () => {
    async function register(email: string) {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, name: email })
        .expect(201);
      return { Authorization: `Bearer ${response.body.accessToken}` };
    }
    const owner = await register('owner@loopkeeper.dev');
    const player = await register('player@loopkeeper.dev');
    const viewer = await register('viewer@loopkeeper.dev');
    const outsider = await register('outsider@loopkeeper.dev');
    const campaign = await request(app.getHttpServer())
      .post('/campaigns')
      .set(owner)
      .send({ title: 'Mystery', description: 'A campaign' })
      .expect(201);
    const campaignId = campaign.body.campaignId;
    for (const [user, role] of [
      [player, 'PLAYER'],
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
      await request(app.getHttpServer())
        .get(`/elements/${id}`)
        .set(player)
        .expect(404);
      await request(app.getHttpServer())
        .get(`/elements/${id}`)
        .set(viewer)
        .expect(404);
      await request(app.getHttpServer())
        .patch(`/elements/${id}`)
        .set(player)
        .send({ access: 'SHARED' })
        .expect(404);
      await request(app.getHttpServer())
        .post(`/elements/${id}/publish`)
        .set(player)
        .expect(404);
      await request(app.getHttpServer())
        .post(`/elements/${id}/publish`)
        .set(owner)
        .expect(201)
        .expect((response) => expect(response.body.access).toBe('SHARED'));
      await request(app.getHttpServer())
        .get(`/elements/${id}`)
        .set(player)
        .expect(200);
      await request(app.getHttpServer())
        .get(`/elements/${id}`)
        .set(viewer)
        .expect(200);
      await request(app.getHttpServer())
        .get(`/elements/${id}`)
        .set(outsider)
        .expect(404);
      await request(app.getHttpServer())
        .post(`/elements/${id}/hide`)
        .set(owner)
        .expect(201)
        .expect((response) => expect(response.body.access).toBe('MASTER_ONLY'));
      await request(app.getHttpServer())
        .get(`/elements/${id}`)
        .set(viewer)
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/elements/${id}`)
        .set(owner)
        .expect(200);
    }
    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/elements`)
      .set(player)
      .expect(200)
      .expect((response) => expect(response.body).toHaveLength(0));
    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/elements`)
      .set(outsider)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/elements`)
      .set(player)
      .send({ type: 'NOTE', title: 'No' })
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
      .get(`/campaigns/${campaignId}/notes`)
      .set(owner)
      .expect(404);
  });
});
