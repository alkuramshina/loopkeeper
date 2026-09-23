
import { ApiProperty } from '@nestjs/swagger';

export class NoteResponseDto {
  @ApiProperty({ format: 'uuid' })
  noteId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ enum: ['PRIVATE', 'MASTER_ONLY', 'PLAYERS', 'PUBLIC'] })
  visibility!: 'PRIVATE' | 'MASTER_ONLY' | 'PLAYERS' | 'PUBLIC';

  @ApiProperty({ format: 'uuid' })
  campaignId!: string;

  @ApiProperty({ format: 'uuid' })
  authorId!: string;
}
