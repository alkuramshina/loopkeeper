import { HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaHealthIndicator } from './prisma-health.indicator';

describe('PrismaHealthIndicator', () => {
  const prisma = {
    $queryRaw: jest.fn(),
  } as unknown as PrismaService;
  const indicator = new PrismaHealthIndicator(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports the database as up when SELECT 1 succeeds', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    await expect(indicator.isHealthy('database')).resolves.toEqual({
      database: { status: 'up' },
    });
  });

  it('reports the database as down when SELECT 1 fails', async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(
      new Error('connection refused'),
    );

    await expect(indicator.isHealthy('database')).rejects.toBeInstanceOf(
      HealthCheckError,
    );
  });
});
