import { CampaignRole } from '@prisma/client';
import { IsEmail, IsEnum } from 'class-validator';

export class CreateMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(CampaignRole)
  role!: CampaignRole;
}
