import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateCharacterDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsUUID()
  templateId!: string;

  @IsObject()
  data!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @IsOptional()
  @IsBoolean()
  isNPC?: boolean;
}
