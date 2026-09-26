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
    expect(
      document.components?.securitySchemes?.['access-token'],
    ).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
    expect(document.paths['/campaigns']).toHaveProperty('get');
    expect(document.paths['/campaigns/{campaignId}/cards']).toHaveProperty(
      'post',
    );
    expect(document.paths['/cards/{cardId}']).toHaveProperty('patch');
    expect(document.paths['/auth/login']).toHaveProperty('post');
    expect(document.paths['/health/live']).toHaveProperty('get');
  });

  it('documents request and successful response schemas for critical operations', () => {
    const loginOperation = document.paths['/auth/login'].post;
    const registerOperation = document.paths['/auth/register'].post;
    const campaignListOperation = document.paths['/campaigns'].get;
    const boardOperation =
      document.paths['/campaigns/{campaignId}/investigation-board'].get;

    expect(loginOperation?.requestBody).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/LoginDto' },
        },
      },
    });
    expect(registerOperation?.responses?.['201']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/LoginResponseDto' },
        },
      },
    });
    expect(campaignListOperation?.responses?.['200']).toMatchObject({
      content: {
        'application/json': {
          schema: {
            items: { $ref: '#/components/schemas/CampaignResponseDto' },
          },
        },
      },
    });
    expect(boardOperation?.responses?.['200']).toMatchObject({
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/InvestigationBoardResponseDto',
          },
        },
      },
    });
    expect(
      document.paths['/elements/{elementId}/access'].patch?.requestBody,
    ).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/UpdateElementAccessDto' },
        },
      },
    });
    expect(document.paths).not.toHaveProperty('/elements/{elementId}/publish');
    expect(document.components?.schemas?.ElementResponseDto).toMatchObject({
      properties: expect.objectContaining({
        createdBy: { $ref: '#/components/schemas/ElementAuthorDto' },
      }),
    });
    expect(document.components?.schemas?.UpdateElementDto).not.toHaveProperty(
      'properties.access',
    );
    expect(document.components?.schemas?.LoginDto).toMatchObject({
      properties: expect.objectContaining({
        email: expect.any(Object),
        password: expect.any(Object),
      }),
      required: ['email', 'password'],
    });
  });

  it('documents the locale-neutral error schema for critical operations', () => {
    const registerResponses = document.paths['/auth/register'].post?.responses;
    const boardResponses =
      document.paths['/campaigns/{campaignId}/cards'].post?.responses;

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
