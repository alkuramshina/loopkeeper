import { CampaignRole } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CampaignInvitationResponseDto {
  @ApiProperty({ format: 'uuid' })
  invitationId!: string;

  @ApiProperty({ format: 'uuid' })
  campaignId!: string;

  @ApiProperty({ enum: CampaignRole })
  role!: CampaignRole;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  acceptedAt!: Date | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  revokedAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'uuid' })
  createdById!: string;
}

export class CreatedCampaignInvitationResponseDto extends CampaignInvitationResponseDto {
  @ApiProperty({ description: 'Secret invitation token. Store it securely; it cannot be retrieved later.' })
  token!: string;
}
