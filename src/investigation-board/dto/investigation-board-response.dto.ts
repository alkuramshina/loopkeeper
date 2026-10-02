import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CARD_COLOR_KEYS } from '../card-colors';
import type { CardColorKey } from '../card-colors';

export class InvestigationBoardNodeResponseDto {
  @ApiProperty({ format: 'uuid' })
  nodeId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty()
  x!: number;

  @ApiProperty()
  y!: number;

  @ApiProperty()
  width!: number;

  @ApiProperty()
  height!: number;

  @ApiProperty({ format: 'uuid' })
  cardId!: string;
}

export class InvestigationCardReferenceResponseDto {
  @ApiProperty({ enum: ['ELEMENT', 'CHARACTER'] })
  kind!: 'ELEMENT' | 'CHARACTER';

  @ApiPropertyOptional({ enum: ['NOTE', 'LOCATION', 'NPC', 'OTHER'] })
  type?: 'NOTE' | 'LOCATION' | 'NPC' | 'OTHER';

  @ApiPropertyOptional({ format: 'uuid' })
  elementId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  characterId?: string;

  @ApiPropertyOptional({ format: 'uri', nullable: true })
  avatarUrl?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'ELEMENT only: authenticated /media/:assetId path of the element cover',
  })
  coverUrl?: string | null;
}

export class InvestigationCardResponseDto {
  @ApiProperty()
  isNew!: boolean;

  @ApiProperty({ format: 'uuid' })
  cardId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ enum: ['FREE', 'ELEMENT_REFERENCE', 'CHARACTER_REFERENCE'] })
  cardKind!: 'FREE' | 'ELEMENT_REFERENCE' | 'CHARACTER_REFERENCE';

  @ApiPropertyOptional({ nullable: true })
  title!: string | null;

  @ApiPropertyOptional({ nullable: true })
  content!: string | null;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiPropertyOptional({ enum: CARD_COLOR_KEYS, nullable: true })
  color!: CardColorKey | null;

  @ApiPropertyOptional({ nullable: true })
  icon!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  elementId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  characterId!: string | null;

  @ApiProperty({ format: 'uuid' })
  boardId!: string;

  @ApiProperty({ format: 'uuid' })
  campaignId!: string;

  @ApiProperty({ format: 'uuid' })
  createdById!: string;

  @ApiProperty({
    type: 'object',
    properties: {
      userId: { type: 'string' },
      name: { type: 'string', nullable: true },
    },
  })
  createdBy!: { userId: string; name: string | null };

  @ApiProperty({
    type: () => InvestigationBoardNodeResponseDto,
    nullable: true,
  })
  node!: InvestigationBoardNodeResponseDto | null;

  @ApiPropertyOptional({ type: () => InvestigationCardReferenceResponseDto })
  reference?: InvestigationCardReferenceResponseDto;
}

export class InvestigationLinkResponseDto {
  @ApiProperty()
  isNew!: boolean;

  @ApiProperty({ format: 'uuid' })
  linkId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  label!: string | null;

  @ApiProperty({ format: 'uuid' })
  boardId!: string;

  @ApiProperty({ format: 'uuid' })
  campaignId!: string;

  @ApiProperty({ format: 'uuid' })
  fromCardId!: string;

  @ApiProperty({ format: 'uuid' })
  toCardId!: string;

  @ApiProperty({ format: 'uuid' })
  createdById!: string;
}

export class InvestigationBoardResponseDto {
  @ApiProperty({ format: 'uuid' })
  boardId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ format: 'uuid' })
  campaignId!: string;

  @ApiProperty({ type: () => InvestigationCardResponseDto, isArray: true })
  cards!: InvestigationCardResponseDto[];

  @ApiProperty({ type: () => InvestigationLinkResponseDto, isArray: true })
  links!: InvestigationLinkResponseDto[];
}
