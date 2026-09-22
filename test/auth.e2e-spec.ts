import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import {
  closeTestDatabase,
  getTestPrisma,
  resetTestDatabase,
} from './helpers/database';

const credentials = {
  email: 'testuser@loopkeeper.dev',
  password: 'test-password-123',
  name: 'Test User',
};

const getCookie = (response: request.Response): string =>
  response.headers['set-cookie'][0].split(';')[0];

describe('Auth (e2e)', () => {
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

  it('registers a user, creates a refresh session and returns a safe profile', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials)
      .expect(201);

    expect(registerResponse.body).toHaveProperty('accessToken');
    expect(registerResponse.body).toHaveProperty('expiresIn');
    expect(registerResponse.body).not.toHaveProperty('passwordHash');
    expect(registerResponse.headers['set-cookie']).toBeDefined();

    const profileResponse = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${registerResponse.body.accessToken}`)
      .expect(200);

    expect(profileResponse.body).toMatchObject({
      email: credentials.email,
      name: credentials.name,
    });
    expect(profileResponse.body).not.toHaveProperty('passwordHash');
    expect(await getTestPrisma().authSession.count()).toBe(1);
  });

  it('updates only the authenticated user profile', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials)
      .expect(201);

    const profileResponse = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${registerResponse.body.accessToken}`)
      .send({ name: 'Updated User' })
      .expect(200);

    expect(profileResponse.body).toMatchObject({
      email: credentials.email,
      name: 'Updated User',
    });
    expect(profileResponse.body).not.toHaveProperty('passwordHash');
  });

  it('rotates refresh sessions and rejects the old refresh token', async () => {
    const agent = request.agent(app.getHttpServer());
    const registerResponse = await agent
      .post('/auth/register')
      .send(credentials)
      .expect(201);
    const oldRefreshCookie = getCookie(registerResponse);

    const refreshResponse = await agent.post('/auth/refresh').expect(200);

    expect(refreshResponse.body).toHaveProperty('accessToken');
    expect(await getTestPrisma().authSession.count()).toBe(2);
    expect(await getTestPrisma().authSession.count({ where: { revokedAt: null } })).toBe(1);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', oldRefreshCookie)
      .expect(401);
  });

  it('logs out the current session and clears the refresh cookie', async () => {
    const agent = request.agent(app.getHttpServer());
    const registerResponse = await agent
      .post('/auth/register')
      .send(credentials)
      .expect(201);
    const refreshCookie = getCookie(registerResponse);

    const logoutResponse = await agent
      .post('/auth/logout')
      .set('Authorization', `Bearer ${registerResponse.body.accessToken}`)
      .expect(204);

    expect(logoutResponse.headers['set-cookie'][0]).toContain('refresh_token=;');

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(401);
  });

  it('changes a password and revokes every refresh session', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials)
      .expect(201);
    const refreshCookie = getCookie(registerResponse);

    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${registerResponse.body.accessToken}`)
      .send({
        currentPassword: credentials.password,
        newPassword: 'new-test-password-123',
      })
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: 'new-test-password-123' })
      .expect(200);
  });

  it('returns conflict for a duplicate email', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials)
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials)
      .expect(409)
      .expect({
        statusCode: 409,
        message: 'A resource with this value already exists',
        error: 'Conflict',
      });
  });
});
