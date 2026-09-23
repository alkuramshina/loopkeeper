import { CampaignRole } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum } from 'class-validator';

export class CreateMemberDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: CampaignRole })
  @IsEnum(CampaignRole)
  role!: CampaignRole;
}
