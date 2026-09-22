import { CampaignRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class CreateInvitationDto {
  @IsEnum(CampaignRole)
  role!: CampaignRole;
}
