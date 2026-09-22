import { CampaignRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateMemberDto {
  @IsEnum(CampaignRole)
  role!: CampaignRole;
}
