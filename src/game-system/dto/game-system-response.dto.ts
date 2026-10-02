import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GameSystemResponseDto {
  @ApiProperty({ enum: ['TALES_FROM_THE_LOOP'] })
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
