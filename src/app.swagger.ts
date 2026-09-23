import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiErrorResponseDto, ApiErrorViolationDto } from './common/swagger/error-response.dto';

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Loopkeeper API')
    .setDescription('Local REST API for tenant-isolated tabletop RPG campaigns. Protected endpoints require a Bearer access token. Refresh tokens are HttpOnly cookies and are never entered in Swagger.')
    .setVersion('1.0')
    .addServer('http://localhost:3000', 'Local development server')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  return SwaggerModule.createDocument(app, config, {
    extraModels: [ApiErrorResponseDto, ApiErrorViolationDto],
  });
}
