import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateInvestigationBoardNodeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  x?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  y?: number;

  @ApiPropertyOptional({ minimum: 80, maximum: 2000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(80)
  @Max(2000)
  width?: number;

  @ApiPropertyOptional({ minimum: 60, maximum: 2000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(60)
  @Max(2000)
  height?: number;
}
