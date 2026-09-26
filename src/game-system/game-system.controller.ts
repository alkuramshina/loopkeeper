import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { GameSystemService } from './game-system.service';
import {
  CharacterTemplateResponseDto,
  GameSystemResponseDto,
} from './dto/game-system-response.dto';

@ApiTags('Game systems')
@ApiBearerAuth('access-token')
@Controller('game-systems')
export class GameSystemController {
  constructor(private readonly gameSystems: GameSystemService) {}

  @ApiOperation({ summary: 'List supported game systems' })
  @ApiOkResponse({ type: GameSystemResponseDto, isArray: true })
  @Get()
  findAll() {
    return this.gameSystems.findAll();
  }

  @ApiOperation({
    summary: 'List active character templates for a game system',
  })
  @ApiParam({ name: 'systemId', enum: ['TALES_FROM_THE_LOOP'] })
  @ApiOkResponse({ type: CharacterTemplateResponseDto, isArray: true })
  @Get(':systemId/templates')
  findTemplates(@Param('systemId') systemId: string) {
    return this.gameSystems.findTemplates(systemId);
  }
}
