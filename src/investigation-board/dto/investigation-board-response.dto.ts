import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ format: 'uuid' })
  elementId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  characterId?: string;

  @ApiPropertyOptional({ format: 'uri', nullable: true })
  avatarUrl?: string | null;
}

export class InvestigationCardResponseDto {
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

  @ApiPropertyOptional({ nullable: true })
  color!: string | null;

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
    type: () => InvestigationBoardNodeResponseDto,
    nullable: true,
  })
  node!: InvestigationBoardNodeResponseDto | null;

  @ApiPropertyOptional({ type: () => InvestigationCardReferenceResponseDto })
  reference?: InvestigationCardReferenceResponseDto;
}

export class InvestigationLinkResponseDto {
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
