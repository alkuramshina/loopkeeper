import { Module } from '@nestjs/common';
import { CampaignModule } from '../campaign/campaign.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EntityViewController } from './entity-view.controller';
import { EntityViewService } from './entity-view.service';

@Module({
  imports: [CampaignModule, PrismaModule],
  controllers: [EntityViewController],
  providers: [EntityViewService],
})
export class EntityViewModule {}
