import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GameSystemService } from './game-system.service';

@ApiTags('Game systems')
@ApiBearerAuth('access-token')
@Controller('game-systems')
export class GameSystemController {
  constructor(private readonly gameSystems: GameSystemService) {}

  @Get()
  findAll() {
    return this.gameSystems.findAll();
  }

  @Get(':systemId/templates')
  findTemplates(@Param('systemId') systemId: string) {
    return this.gameSystems.findTemplates(systemId);
  }
}
