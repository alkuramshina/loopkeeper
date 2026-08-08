import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { validationSchema } from './config/validation';
import { UserModule } from './user/user.module';
import appConfig from './config/app.config';
import jwtConfig from './auth/config/jwt.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        jwtConfig,
      ],
      validationSchema,
    }),
    HealthModule, AuthModule, UserModule
  ],
})
export class AppModule { }
