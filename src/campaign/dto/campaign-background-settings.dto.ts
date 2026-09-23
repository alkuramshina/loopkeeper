import { CampaignBackgroundSelectionMode } from '@prisma/client';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CampaignBackgroundDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  backgroundId!: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    format: 'uri',
    maxLength: 2048,
    example: 'https://example.com/background.jpg',
  })
  @IsUrl({
    protocols: ['https'],
    require_protocol: true,
    require_host: true,
  })
  @MaxLength(2048)
  imageUrl!: string;

  @ApiProperty()
  @IsBoolean()
  isEnabled!: boolean;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class UpdateCampaignBackgroundSettingsDto {
  @ApiProperty({ enum: CampaignBackgroundSelectionMode })
  @IsEnum(CampaignBackgroundSelectionMode)
  selectionMode!: CampaignBackgroundSelectionMode;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @ValidateIf((object) => object.fixedBackgroundId !== null)
  @IsUUID('all')
  fixedBackgroundId!: string | null;

  @ApiProperty({
    type: CampaignBackgroundDto,
    isArray: true,
    maxItems: 10,
  })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CampaignBackgroundDto)
  backgrounds!: CampaignBackgroundDto[];
}

export class CampaignBackgroundSettingsResponseDto {
  @ApiProperty({ enum: CampaignBackgroundSelectionMode })
  selectionMode!: CampaignBackgroundSelectionMode;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  fixedBackgroundId!: string | null;

  @ApiProperty({
    type: CampaignBackgroundDto,
    isArray: true,
    maxItems: 10,
  })
  backgrounds!: CampaignBackgroundDto[];
}

export class CampaignBackgroundRenderConfigDto {
  @ApiProperty({ enum: CampaignBackgroundSelectionMode })
  selectionMode!: CampaignBackgroundSelectionMode;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  fixedBackgroundId!: string | null;

  @ApiProperty({ type: CampaignBackgroundDto, isArray: true })
  backgrounds!: CampaignBackgroundDto[];
}
