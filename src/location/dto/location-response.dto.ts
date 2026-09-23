import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LocationResponseDto {
  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ maxLength: 200 })
  title!: string;

  @ApiPropertyOptional({ maxLength: 10000, nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ format: 'uri', maxLength: 2048, nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ minimum: 0 })
  sortOrder!: number;

  @ApiProperty({ format: 'uuid' })
  campaignId!: string;

  @ApiProperty({ format: 'uuid' })
  createdById!: string;
}
