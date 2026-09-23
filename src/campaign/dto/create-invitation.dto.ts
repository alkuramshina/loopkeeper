import { CampaignRole } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class CreateInvitationDto {
  @ApiProperty({ enum: CampaignRole })
  @IsEnum(CampaignRole)
  role!: CampaignRole;
}
