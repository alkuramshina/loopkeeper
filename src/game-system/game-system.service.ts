import { HttpStatus, Injectable } from '@nestjs/common';
import { System } from '@prisma/client';
import { DomainException } from '../common/exceptions/domain.exception';
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
      throw new DomainException(
        HttpStatus.NOT_FOUND,
        'resource.not_found',
        'The requested game system is unavailable',
      );
    }

    return this.prisma.characterTemplate.findMany({
      where: { systemSlug: gameSystem.slug, isActive: true },
      orderBy: [{ name: 'asc' }, { version: 'desc' }],
    });
  }
}
