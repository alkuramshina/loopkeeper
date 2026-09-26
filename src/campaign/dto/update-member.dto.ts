import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { AssignableCampaignRole } from './assignable-campaign-role';
import { assignableCampaignRoles } from './assignable-campaign-role';

export class UpdateMemberDto {
  @ApiProperty({ enum: assignableCampaignRoles })
  @IsIn(assignableCampaignRoles)
  role!: AssignableCampaignRole;
}
