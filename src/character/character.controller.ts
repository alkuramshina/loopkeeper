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
import { CharacterService } from './character.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';
import { CharacterResponseDto } from './dto/character-response.dto';

@ApiTags('Characters')
@ApiBearerAuth('access-token')
@Controller()
export class CharacterController {
  constructor(private readonly characters: CharacterService) {}

  @ApiOperation({ summary: 'Create a character in a campaign' })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiCreatedResponse({ type: CharacterResponseDto })
  @Post('campaigns/:campaignId/characters')
  create(
    @Param('campaignId') campaignId: string,
    @Body() createDto: CreateCharacterDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.characters.create(request.user.userId, campaignId, createDto);
  }

  @ApiOperation({ summary: 'List characters in an accessible campaign' })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiOkResponse({ type: CharacterResponseDto, isArray: true })
  @Get('campaigns/:campaignId/characters')
  findAll(
    @Param('campaignId') campaignId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.characters.findAll(request.user.userId, campaignId);
  }

  @ApiOperation({ summary: 'Get an accessible character' })
  @ApiParam({ name: 'characterId', format: 'uuid' })
  @ApiOkResponse({ type: CharacterResponseDto })
  @Get('characters/:characterId')
  findOne(
    @Param('characterId') characterId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.characters.findOne(request.user.userId, characterId);
  }

  @ApiOperation({
    summary: 'Update a character owned by the authenticated user',
  })
  @ApiParam({ name: 'characterId', format: 'uuid' })
  @ApiOkResponse({ type: CharacterResponseDto })
  @Patch('characters/:characterId')
  update(
    @Param('characterId') characterId: string,
    @Body() updateDto: UpdateCharacterDto,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.characters.update(request.user.userId, characterId, updateDto);
  }

  @ApiOperation({
    summary: 'Delete a character owned by the authenticated user',
  })
  @ApiParam({ name: 'characterId', format: 'uuid' })
  @ApiOkResponse({ description: 'Character deleted' })
  @Delete('characters/:characterId')
  remove(
    @Param('characterId') characterId: string,
    @Request() request: { user: TokenPayloadDto },
  ) {
    return this.characters.remove(request.user.userId, characterId);
  }
}
