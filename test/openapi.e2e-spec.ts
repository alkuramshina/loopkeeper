import { INestApplication } from '@nestjs/common';
import { OpenAPIObject } from '@nestjs/swagger';
import { createOpenApiDocument } from '../src/app.swagger';
import { createTestApp } from './helpers/app';
import { closeTestDatabase } from './helpers/database';

describe('OpenAPI contract', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    app = await createTestApp();
    document = createOpenApiDocument(app);
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  it('documents critical protected routes and the access-token scheme', () => {
    expect(document.components?.securitySchemes?.['access-token']).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
    expect(document.paths['/campaigns']).toHaveProperty('get');
    expect(document.paths['/campaigns/{campaignId}/cards']).toHaveProperty('post');
    expect(document.paths['/cards/{cardId}']).toHaveProperty('patch');
    expect(document.paths['/auth/login']).toHaveProperty('post');
    expect(document.paths['/health/live']).toHaveProperty('get');
  });

  it('documents the locale-neutral error schema for critical operations', () => {
    const registerResponses = document.paths['/auth/register'].post?.responses;
    const boardResponses = document.paths['/campaigns/{campaignId}/cards'].post?.responses;

    expect(registerResponses).toHaveProperty('400');
    expect(registerResponses).toHaveProperty('409');
    expect(boardResponses).toHaveProperty('400');
    expect(boardResponses).toHaveProperty('404');
    expect(boardResponses).toHaveProperty('409');
    expect(document.components?.schemas?.ApiErrorResponseDto).toMatchObject({
      properties: expect.objectContaining({
        statusCode: expect.any(Object),
        code: expect.any(Object),
        message: expect.any(Object),
        violations: expect.any(Object),
      }),
    });
  });
});
