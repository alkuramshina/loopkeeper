import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GameSystemService } from './game-system.service';
import { GameSystemResponseDto } from './dto/game-system-response.dto';

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
}
