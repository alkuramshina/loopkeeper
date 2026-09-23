import { CharacterTemplateKind } from '@prisma/client';
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

export class CharacterTemplateResponseDto {
  @ApiProperty({ format: 'uuid' })
  templateId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  schema!: Record<string, unknown>;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiProperty({ enum: CharacterTemplateKind })
  characterKind!: CharacterTemplateKind;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ enum: ['TALES_FROM_THE_LOOP'] })
  systemSlug!: string;
}
