import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let AppModule: any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/testdb';
    process.env.JWT_SECRET = 'test_jwt_secret_1234567890';
    process.env.REFRESH_JWT_SECRET = 'test_refresh_secret_1234567890';
    process.env.REFRESH_COOKIE_NAME = 'refresh_token';
    process.env.REFRESH_COOKIE_SECURE = 'false';
    process.env.REFRESH_COOKIE_SAMESITE = 'lax';

    // Load AppModule after env vars are set so ConfigModule sees them.
    // Using require avoids dynamic import issues in the current Jest configuration.
    ({ AppModule } = require('./../src/app.module'));

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/auth/login should set refresh_token cookie and return accessToken', async () => {
    const credentials = {
      username: 'testuser',
      password: 'testpass',
    };

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);

    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('expiresIn');
    expect(response.headers['set-cookie']).toBeDefined();
    expect(response.headers['set-cookie'][0]).toContain('refresh_token=');
  });

  it('/auth/refresh should return new accessToken when refresh_token cookie is present', async () => {
    const credentials = {
      username: 'testuser',
      password: 'testpass',
    };

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);

    const cookie = loginResponse.headers['set-cookie'];
    expect(cookie).toBeDefined();

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);

    expect(refreshResponse.body).toHaveProperty('accessToken');
    expect(refreshResponse.headers['set-cookie']).toBeDefined();
    expect(refreshResponse.headers['set-cookie'][0]).toContain('refresh_token=');
  });
});