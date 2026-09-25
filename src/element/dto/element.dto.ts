import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
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
    default: CampaignElementAccess.MASTER_ONLY,
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
    description: 'Transitional location map URL',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  imageUrl?: string;
}

export class UpdateElementDto extends PartialType(CreateElementDto) {}

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

  @ApiPropertyOptional({ nullable: true, format: 'uri' })
  imageUrl!: string | null;

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
}
