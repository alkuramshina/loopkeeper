import { Module } from '@nestjs/common';
import { CampaignModule } from '../campaign/campaign.module';
import { MediaModule } from '../media/media.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ElementController } from './element.controller';
import { ElementService } from './element.service';

@Module({
  imports: [PrismaModule, CampaignModule, MediaModule],
  controllers: [ElementController],
  providers: [ElementService],
})
export class ElementModule {}
