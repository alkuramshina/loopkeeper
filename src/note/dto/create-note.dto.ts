import { NoteVisibility } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength } from 'class-validator';

export class CreateNoteDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ maxLength: 10000 })
  @IsString()
  @MaxLength(10000)
  content!: string;

  @ApiProperty({ enum: NoteVisibility })
  @IsEnum(NoteVisibility)
  visibility!: NoteVisibility;
}
