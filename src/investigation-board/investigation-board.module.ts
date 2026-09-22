import { Module } from '@nestjs/common';
import { CampaignModule } from '../campaign/campaign.module';
import { PrismaModule } from '../prisma/prisma.module';
import { InvestigationBoardController } from './investigation-board.controller';
import { InvestigationBoardService } from './investigation-board.service';
@Module({
  imports: [PrismaModule, CampaignModule],
  controllers: [InvestigationBoardController],
  providers: [InvestigationBoardService],
})
export class InvestigationBoardModule {}
