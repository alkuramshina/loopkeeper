import { NoteVisibility } from '@prisma/client';
import { IsEnum, IsString, MaxLength } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(10000)
  content!: string;

  @IsEnum(NoteVisibility)
  visibility!: NoteVisibility;
}
