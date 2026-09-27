import { System } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateCampaignDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  title!: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ enum: System })
  @IsOptional()
  @IsEnum(System)
  system?: System;

  @ApiPropertyOptional({ format: 'uri' })
  @IsOptional()
  @IsUrl()
  coverUrl?: string;
}
