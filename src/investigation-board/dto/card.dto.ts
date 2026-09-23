import { InvestigationCardKind } from '@prisma/client';
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
  @IsOptional()
  @IsEnum(InvestigationCardKind)
  cardKind?: InvestigationCardKind;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @IsOptional()
  @IsUUID()
  noteId?: string;

  @IsOptional()
  @IsUUID()
  characterId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{3,8}$/)
  color?: string;

  @IsOptional()
  @Matches(/^[a-z0-9-]{1,40}$/)
  icon?: string;
}

export class UpdateInvestigationCardDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{3,8}$/)
  color?: string;

  @IsOptional()
  @Matches(/^[a-z0-9-]{1,40}$/)
  icon?: string;
}
