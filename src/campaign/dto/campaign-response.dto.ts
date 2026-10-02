import { CampaignRole, System } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CampaignResponseDto {
  @ApiProperty({ format: 'uuid' })
  campaignId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ maxLength: 100 })
  title!: string;

  @ApiPropertyOptional({ enum: System, nullable: true })
  system!: System | null;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ format: 'uri', nullable: true })
  coverUrl!: string | null;

  @ApiProperty({ enum: CampaignRole })
  currentUserRole!: CampaignRole;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'date-time',
    description: 'When the current user last opened this campaign.',
  })
  lastVisitAt!: Date | null;

  @ApiProperty({ minimum: 0 })
  newVisibleMaterialCount!: number;
}

export class CampaignVisitResponseDto {
  @ApiProperty({ format: 'date-time' })
  lastVisitAt!: Date;
}
