import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { validationSchema } from './config/validation';
import { UserModule } from './user/user.module';
import appConfig from './config/app.config';
import jwtConfig from './auth/config/jwt.config';
import { PrismaModule } from './prisma/prisma.module';
import { CampaignModule } from './campaign/campaign.module';

const nodeEnv = (process.env.NODE_ENV ?? 'development') as
  | 'development'
  | 'test'
  | 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        jwtConfig,
      ],
      validationSchema,
      envFilePath: [`.env.${nodeEnv}`, '.env'],
      ignoreEnvFile: nodeEnv === 'production',
    }),
    HealthModule, AuthModule, UserModule, PrismaModule, CampaignModule
  ],
})
export class AppModule { }
