import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateInvestigationLinkDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cardAId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cardBId!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;
}

export class UpdateInvestigationLinkDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;
}
