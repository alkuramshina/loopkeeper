import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { CampaignElementAccess, CampaignElementType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateElementDto {
  @ApiProperty({ enum: CampaignElementType })
  @IsEnum(CampaignElementType)
  type!: CampaignElementType;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ description: 'Raw Markdown' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @ApiPropertyOptional({
    enum: CampaignElementAccess,
    description:
      'Defaults to MASTER_ONLY for the campaign owner and PRIVATE for a player. PRIVATE is available to players only.',
  })
  @IsOptional()
  @IsEnum(CampaignElementAccess)
  access?: CampaignElementAccess;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  typeData?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    format: 'uri',
    nullable: true,
    description:
      'External HTTPS location map URL. Setting it (or null) removes an uploaded map file.',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  imageUrl?: string;
}

export class UpdateElementDto extends PartialType(
  OmitType(CreateElementDto, ['access'] as const),
) {}

export class UpdateElementAccessDto {
  @ApiProperty({ enum: CampaignElementAccess })
  @IsEnum(CampaignElementAccess)
  access!: CampaignElementAccess;
}

export class ElementAuthorDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;
}

export class ElementResponseDto {
  @ApiProperty({ format: 'uuid' })
  elementId!: string;

  @ApiProperty({ format: 'uuid' })
  campaignId!: string;

  @ApiProperty({ enum: CampaignElementType })
  type!: CampaignElementType;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Raw Markdown' })
  content!: string | null;

  @ApiProperty({ enum: CampaignElementAccess })
  access!: CampaignElementAccess;

  @ApiProperty({ type: 'object', additionalProperties: true })
  typeData!: Record<string, unknown>;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'LOCATION map: an external HTTPS URL or an authenticated /media/:assetId path',
  })
  imageUrl!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Authenticated /media/:assetId path of the element cover',
  })
  coverUrl!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  coverAssetId!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  mapAssetId!: string | null;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ format: 'uuid' })
  createdById!: string;

  @ApiProperty({ type: ElementAuthorDto })
  createdBy!: ElementAuthorDto;
}
