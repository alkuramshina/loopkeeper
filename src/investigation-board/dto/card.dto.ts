import { InvestigationCardKind } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateInvestigationCardDto {
  @ApiPropertyOptional({ enum: InvestigationCardKind })
  @IsOptional()
  @IsEnum(InvestigationCardKind)
  cardKind?: InvestigationCardKind;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ maxLength: 10000 })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  elementId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  characterId?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 30 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ pattern: '^#[0-9a-fA-F]{3,8}$' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{3,8}$/)
  color?: string;

  @ApiPropertyOptional({ pattern: '^[a-z0-9-]{1,40}$' })
  @IsOptional()
  @Matches(/^[a-z0-9-]{1,40}$/)
  icon?: string;
}

export class UpdateInvestigationCardDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ maxLength: 10000 })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 30 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ pattern: '^#[0-9a-fA-F]{3,8}$' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{3,8}$/)
  color?: string;

  @ApiPropertyOptional({ pattern: '^[a-z0-9-]{1,40}$' })
  @IsOptional()
  @Matches(/^[a-z0-9-]{1,40}$/)
  icon?: string;
}
