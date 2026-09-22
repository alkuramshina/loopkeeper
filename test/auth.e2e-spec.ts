import { INestApplication } from '@nestjs/common';
import argon2 from 'argon2';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import {
  closeTestDatabase,
  getTestPrisma,
  resetTestDatabase,
} from './helpers/database';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  const credentials = {
    email: 'testuser@loopkeeper.dev',
    password: 'test-password',
  };

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestDatabase();
    await getTestPrisma().user.create({
      data: {
        email: credentials.email,
        passwordHash: await argon2.hash(credentials.password),
        name: 'Test User',
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('logs in and sets a refresh cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);

    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('expiresIn');
    expect(response.headers['set-cookie']).toBeDefined();
    expect(response.headers['set-cookie'][0]).toContain('refresh_token=');
  });

  it('refreshes an access token from the refresh cookie', async () => {
    const agent = request.agent(app.getHttpServer());
    const loginResponse = await agent.post('/auth/login').send(credentials).expect(200);

    expect(loginResponse.headers['set-cookie']).toBeDefined();

    const refreshResponse = await agent.post('/auth/refresh').expect(200);

    expect(refreshResponse.body).toHaveProperty('accessToken');
    expect(refreshResponse.headers['set-cookie']).toBeDefined();
    expect(refreshResponse.headers['set-cookie'][0]).toContain('refresh_token=');
  });

  it('rejects invalid credentials', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ ...credentials, password: 'wrong-password' })
      .expect(401)
      .expect({
        statusCode: 401,
        message: 'Invalid credentials or user not found',
        error: 'Unauthorized',
      });
  });
});
