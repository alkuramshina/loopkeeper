import { Injectable, NotFoundException } from '@nestjs/common';
import { System } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GameSystemService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.gameSystem.findMany({ orderBy: { name: 'asc' } });
  }

  async findTemplates(systemId: string) {
    const gameSystem = await this.prisma.gameSystem.findUnique({
      where: { slug: systemId as System },
      select: { slug: true },
    });

    if (!gameSystem) {
      throw new NotFoundException('Game system not found');
    }

    return this.prisma.characterTemplate.findMany({
      where: { systemSlug: gameSystem.slug, isActive: true },
      orderBy: [{ name: 'asc' }, { version: 'desc' }],
    });
  }
}
