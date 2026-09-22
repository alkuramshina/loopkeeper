import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateInvestigationLinkDto {
  @IsUUID() cardAId!: string;
  @IsUUID() cardBId!: string;
  @IsOptional() @IsString() @MaxLength(200) label?: string;
}

export class UpdateInvestigationLinkDto {
  @IsOptional() @IsString() @MaxLength(200) label?: string;
}
