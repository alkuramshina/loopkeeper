import { ApiProperty } from '@nestjs/swagger';
import { EntityViewType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class EntityViewInputDto {
  @ApiProperty({ enum: EntityViewType })
  @IsEnum(EntityViewType)
  entityType!: EntityViewType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  entityId!: string;
}

export class RecordViewsDto {
  @ApiProperty({ type: [EntityViewInputDto], minItems: 1, maxItems: 500 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => EntityViewInputDto)
  entities!: EntityViewInputDto[];
}
