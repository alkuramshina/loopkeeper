import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { NoteService } from './note.service';

@ApiTags('Notes')
@ApiBearerAuth('access-token')
@Controller()
export class NoteController {
  constructor(private readonly notes: NoteService) {}

  @Post('campaigns/:campaignId/notes')
  create(
    @Param('campaignId') campaignId: string,
    @Body() createDto: CreateNoteDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.notes.create(request.user.userId, campaignId, createDto);
  }

  @Get('campaigns/:campaignId/notes')
  findAll(
    @Param('campaignId') campaignId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.notes.findAll(request.user.userId, campaignId);
  }

  @Get('notes/:noteId')
  findOne(
    @Param('noteId') noteId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.notes.findOne(request.user.userId, noteId);
  }

  @Patch('notes/:noteId')
  update(
    @Param('noteId') noteId: string,
    @Body() updateDto: UpdateNoteDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.notes.update(request.user.userId, noteId, updateDto);
  }

  @Delete('notes/:noteId')
  remove(
    @Param('noteId') noteId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.notes.remove(request.user.userId, noteId);
  }
}
