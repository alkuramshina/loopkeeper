import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaHealthIndicator } from './prisma-health.indicator';
import { MediaStorageModule } from '../media/media-storage.module';
import { MediaHealthIndicator } from './media-health.indicator';

@Module({
  imports: [TerminusModule, PrismaModule, MediaStorageModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, MediaHealthIndicator],
})
export class HealthModule {}
