import { Module } from '@nestjs/common';
import { CampaignModule } from '../campaign/campaign.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { CharacterController } from './character.controller';
import { CharacterService } from './character.service';

@Module({
  imports: [PrismaModule, CampaignModule, MediaModule],
  controllers: [CharacterController],
  providers: [CharacterService],
})
export class CharacterModule {}
