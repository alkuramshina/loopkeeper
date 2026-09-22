import { Controller, Get, Param } from '@nestjs/common';
import { GameSystemService } from './game-system.service';

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
