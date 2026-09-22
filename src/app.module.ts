import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { validationSchema } from './config/validation';
import { UserModule } from './user/user.module';
import appConfig from './config/app.config';
import jwtConfig from './auth/config/jwt.config';
import { PrismaModule } from './prisma/prisma.module';
import { CampaignModule } from './campaign/campaign.module';
import { CharacterModule } from './character/character.module';
import { GameSystemModule } from './game-system/game-system.module';

const nodeEnv = (process.env.NODE_ENV ?? 'development') as
  'development' | 'test' | 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig],
      validationSchema,
      envFilePath: [`.env.${nodeEnv}`, '.env'],
      ignoreEnvFile: nodeEnv === 'production',
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [appConfig.KEY],
      useFactory: (config: ConfigType<typeof appConfig>) => ({
        throttlers: [
          {
            ttl: config.throttleTtl,
            limit: config.throttleLimit,
          },
        ],
      }),
    }),
    HealthModule,
    AuthModule,
    UserModule,
    PrismaModule,
    CampaignModule,
    GameSystemModule,
    CharacterModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
