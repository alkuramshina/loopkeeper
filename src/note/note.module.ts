import { Module } from '@nestjs/common';
import { CampaignModule } from '../campaign/campaign.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NoteController } from './note.controller';
import { NoteService } from './note.service';

@Module({
  imports: [PrismaModule, CampaignModule],
  controllers: [NoteController],
  providers: [NoteService],
})
export class NoteModule {}
