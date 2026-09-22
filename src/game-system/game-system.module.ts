import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GameSystemController } from './game-system.controller';
import { GameSystemService } from './game-system.service';

@Module({
  imports: [PrismaModule],
  controllers: [GameSystemController],
  providers: [GameSystemService],
})
export class GameSystemModule {}
