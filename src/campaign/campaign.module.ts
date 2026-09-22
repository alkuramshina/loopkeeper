import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { CampaignAccessService } from './access/campaign-access.service';
import { CampaignController } from './campaign.controller';
import { CampaignInvitationController } from './campaign-invitation.controller';
import { CampaignInvitationService } from './campaign-invitation.service';
import { CampaignMemberController } from './campaign-member.controller';
import { CampaignMemberService } from './campaign-member.service';
import { CampaignService } from './campaign.service';

@Module({
  imports: [PrismaModule, UserModule],
  controllers: [
    CampaignController,
    CampaignMemberController,
    CampaignInvitationController,
  ],
  providers: [
    CampaignService,
    CampaignAccessService,
    CampaignMemberService,
    CampaignInvitationService,
  ],
  exports: [CampaignAccessService],
})
export class CampaignModule {}
