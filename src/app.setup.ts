import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import jwtConfig from './auth/config/jwt.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import appConfig from './config/app.config';

export function configureApplication(app: INestApplication): void {
  const applicationConfig = app.get<ConfigType<typeof appConfig>>(
    appConfig.KEY,
  );
  const jwtTokenConfig = app.get<ConfigType<typeof jwtConfig>>(jwtConfig.KEY);

  app.use(helmet());
  app.enableCors({
    origin: applicationConfig.frontendUrl,
    credentials: true,
  });
  app.use(cookieParser());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      validationError: { target: false },
    }),
  );

  if (
    jwtTokenConfig.refreshCookieSameSite === 'none' &&
    !jwtTokenConfig.refreshCookieSecure
  ) {
    throw new Error('SameSite=none requires secure refresh cookies.');
  }
}
