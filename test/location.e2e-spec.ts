import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { closeTestDatabase, resetTestDatabase } from './helpers/database';

describe('Location elements (e2e)', () => {
  let app: INestApplication;
  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });
  afterEach(async () => app.close());
  afterAll(async () => closeTestDatabase());

  it('keeps map URL separate from markdown and filters the catalog by type', async () => {
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'owner@loopkeeper.dev',
        password: 'test-password-123',
        name: 'Owner',
      })
      .expect(201);
    const auth = { Authorization: `Bearer ${registered.body.accessToken}` };
    const campaign = await request(app.getHttpServer())
      .post('/campaigns')
      .set(auth)
      .send({ title: 'Mystery', description: 'A campaign' })
      .expect(201);
    const url = `/campaigns/${campaign.body.campaignId}/elements`;
    const created = await request(app.getHttpServer())
      .post(url)
      .set(auth)
      .send({
        type: 'LOCATION',
        title: 'The station',
        content: '**Map notes**',
        imageUrl: 'https://example.com/map.png',
        sortOrder: 3,
      })
      .expect(201);
    expect(created.body).toMatchObject({
      type: 'LOCATION',
      content: '**Map notes**',
      imageUrl: 'https://example.com/map.png',
    });
    await request(app.getHttpServer())
      .get(`${url}?type=LOCATION`)
      .set(auth)
      .expect(200)
      .expect((response) =>
        expect(
          response.body.map(
            (element: { elementId: string }) => element.elementId,
          ),
        ).toEqual([created.body.elementId]),
      );
    await request(app.getHttpServer())
      .get(`${url}?type=NOTE`)
      .set(auth)
      .expect(200)
      .expect((response) => expect(response.body).toHaveLength(0));
    await request(app.getHttpServer())
      .post(url)
      .set(auth)
      .send({
        type: 'NOTE',
        title: 'Invalid map',
        imageUrl: 'https://example.com/map.png',
      })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/locations/${created.body.elementId}`)
      .set(auth)
      .expect(404);
  });
});
