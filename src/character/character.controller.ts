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
import { TokenPayloadDto } from '../auth/dto/token-payload.dto';
import { CharacterService } from './character.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';

@Controller()
export class CharacterController {
  constructor(private readonly characters: CharacterService) {}

  @Post('campaigns/:campaignId/characters')
  create(
    @Param('campaignId') campaignId: string,
    @Body() createDto: CreateCharacterDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.characters.create(request.user.userId, campaignId, createDto);
  }

  @Get('campaigns/:campaignId/characters')
  findAll(
    @Param('campaignId') campaignId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.characters.findAll(request.user.userId, campaignId);
  }

  @Get('characters/:characterId')
  findOne(
    @Param('characterId') characterId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.characters.findOne(request.user.userId, characterId);
  }

  @Patch('characters/:characterId')
  update(
    @Param('characterId') characterId: string,
    @Body() updateDto: UpdateCharacterDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.characters.update(request.user.userId, characterId, updateDto);
  }

  @Delete('characters/:characterId')
  remove(
    @Param('characterId') characterId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.characters.remove(request.user.userId, characterId);
  }
}
