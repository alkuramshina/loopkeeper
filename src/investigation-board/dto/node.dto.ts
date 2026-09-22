import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateInvestigationBoardNodeDto {
  @IsOptional() @Type(() => Number) @IsNumber() x?: number;
  @IsOptional() @Type(() => Number) @IsNumber() y?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(80)
  @Max(2000)
  width?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(60)
  @Max(2000)
  height?: number;
}
