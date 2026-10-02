import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class GameSystemService {
  constructor(private readonly prisma: PrismaService) {}
  findAll() {
    return this.prisma.gameSystem.findMany({ orderBy: { name: 'asc' } });
  }
}
