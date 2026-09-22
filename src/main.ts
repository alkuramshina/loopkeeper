import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { configureApplication } from './app.setup';
import appConfig from './config/app.config';
import { ConfigType } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApplication(app);

  const docConfig = new DocumentBuilder()
    .setTitle('Loopkeeper API')
    .setVersion('1.0')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, docConfig);
  SwaggerModule.setup('docs', app, documentFactory);

  const applicationConfig = app.get<ConfigType<typeof appConfig>>(
    appConfig.KEY,
  );

  await app.listen(applicationConfig.port);
}

bootstrap();
