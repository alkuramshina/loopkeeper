import { CampaignRole } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CampaignMemberUserResponseDto } from './campaign-member-response.dto';

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

  @ApiPropertyOptional({
    type: CampaignMemberUserResponseDto,
    nullable: true,
    description: 'Who accepted the invitation. Null while it is not accepted.',
  })
  acceptedBy!: CampaignMemberUserResponseDto | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Invitation link token, only while the invitation can still be accepted. Null for used, revoked or expired invitations.',
  })
  token!: string | null;
}

export class CreatedCampaignInvitationResponseDto extends CampaignInvitationResponseDto {
  @ApiProperty({ description: 'Invitation link token.' })
  declare token: string;
}

export class CampaignInvitationPreviewResponseDto {
  @ApiProperty()
  campaignTitle!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  masterName!: string | null;

  @ApiProperty({ enum: CampaignRole })
  role!: CampaignRole;
}
