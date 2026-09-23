import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CharacterResponseDto {
  @ApiProperty({ format: 'uuid' })
  characterId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ maxLength: 100 })
  name!: string;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ format: 'uri', nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  data!: Record<string, unknown>;

  @ApiProperty()
  isNPC!: boolean;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ format: 'uuid' })
  campaignId!: string;

  @ApiProperty({ format: 'uuid' })
  ownerId!: string;

  @ApiProperty({ format: 'uuid' })
  templateId!: string;
}
