import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaModule } from '../media/media.module';

import { CampaignAccessService } from './access/campaign-access.service';
import { CampaignBackgroundSettingsController } from './campaign-background-settings.controller';
import { CampaignBackgroundSettingsService } from './campaign-background-settings.service';
import { CampaignController } from './campaign.controller';
import { CampaignInvitationController } from './campaign-invitation.controller';
import { CampaignInvitationService } from './campaign-invitation.service';
import { CampaignMemberController } from './campaign-member.controller';
import { CampaignMemberService } from './campaign-member.service';
import { CampaignService } from './campaign.service';

@Module({
  imports: [PrismaModule, MediaModule],
  controllers: [
    CampaignController,
    CampaignBackgroundSettingsController,
    CampaignMemberController,
    CampaignInvitationController,
  ],
  providers: [
    CampaignService,
    CampaignBackgroundSettingsService,
    CampaignAccessService,
    CampaignMemberService,
    CampaignInvitationService,
  ],
  exports: [CampaignAccessService],
})
export class CampaignModule {}
