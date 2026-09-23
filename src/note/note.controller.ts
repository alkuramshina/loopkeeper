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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { NoteResponseDto } from './dto/note-response.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { NoteService } from './note.service';

@ApiTags('Notes')
@ApiBearerAuth('access-token')
@Controller()
export class NoteController {
  constructor(private readonly notes: NoteService) {}

  @ApiOperation({ summary: 'Create a campaign note' })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiCreatedResponse({ type: NoteResponseDto })
  @Post('campaigns/:campaignId/notes')
  create(
    @Param('campaignId') campaignId: string,
    @Body() createDto: CreateNoteDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.notes.create(request.user.userId, campaignId, createDto);
  }

  @ApiOperation({ summary: 'List campaign notes visible to the requester' })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiOkResponse({ type: NoteResponseDto, isArray: true })
  @Get('campaigns/:campaignId/notes')
  findAll(
    @Param('campaignId') campaignId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.notes.findAll(request.user.userId, campaignId);
  }

  @ApiOperation({ summary: 'Get a note visible to the requester' })
  @ApiParam({ name: 'noteId', format: 'uuid' })
  @ApiOkResponse({ type: NoteResponseDto })
  @Get('notes/:noteId')
  findOne(
    @Param('noteId') noteId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.notes.findOne(request.user.userId, noteId);
  }

  @ApiOperation({ summary: 'Update a campaign note' })
  @ApiParam({ name: 'noteId', format: 'uuid' })
  @ApiOkResponse({ type: NoteResponseDto })
  @Patch('notes/:noteId')
  update(
    @Param('noteId') noteId: string,
    @Body() updateDto: UpdateNoteDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.notes.update(request.user.userId, noteId, updateDto);
  }

  @ApiOperation({ summary: 'Delete a campaign note' })
  @ApiParam({ name: 'noteId', format: 'uuid' })
  @ApiOkResponse({ description: 'The note was deleted.' })
  @Delete('notes/:noteId')
  remove(
    @Param('noteId') noteId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.notes.remove(request.user.userId, noteId);
  }
}
