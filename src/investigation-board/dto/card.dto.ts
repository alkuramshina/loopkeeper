import { PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateInvestigationCardDto {
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(10000) content?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];
  @IsOptional() @Matches(/^#[0-9a-fA-F]{3,8}$/) color?: string;
  @IsOptional() @Matches(/^[a-z0-9-]{1,40}$/) icon?: string;
}

export class UpdateInvestigationCardDto extends PartialType(
  CreateInvestigationCardDto,
) {}
