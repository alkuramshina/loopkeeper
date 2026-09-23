import { Module } from '@nestjs/common';
import { CampaignModule } from '../campaign/campaign.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';

@Module({
  imports: [PrismaModule, CampaignModule],
  controllers: [LocationController],
  providers: [LocationService],
})
export class LocationModule {}
