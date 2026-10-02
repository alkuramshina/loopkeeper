import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApplication } from './app.setup';
import appConfig from './config/app.config';
import { ConfigType } from '@nestjs/config';
import { createOpenApiDocument } from './app.swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApplication(app);

  const applicationConfig = app.get<ConfigType<typeof appConfig>>(
    appConfig.KEY,
  );
  if (applicationConfig.environment !== 'production') {
    SwaggerModule.setup('docs', app, () => createOpenApiDocument(app));
  }
  await app.listen(applicationConfig.port);
}

void bootstrap();
