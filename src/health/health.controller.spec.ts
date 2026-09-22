import { HealthCheckService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma-health.indicator';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const health = {
    check: jest.fn(),
  } as unknown as HealthCheckService;
  const prismaHealth = {
    isHealthy: jest.fn(),
  } as unknown as PrismaHealthIndicator;
  const controller = new HealthController(health, prismaHealth);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports liveness without checking dependencies', () => {
    expect(controller.checkLiveness()).toEqual({ status: 'ok' });
    expect(health.check).not.toHaveBeenCalled();
  });

  it('uses the Prisma health indicator for readiness', async () => {
    (prismaHealth.isHealthy as jest.Mock).mockResolvedValue({
      database: { status: 'up' },
    });
    (health.check as jest.Mock).mockResolvedValue({ status: 'ok' });

    await expect(controller.checkReadiness()).resolves.toEqual({ status: 'ok' });

    const checks = (health.check as jest.Mock).mock.calls[0][0] as Array<
      () => Promise<unknown>
    >;
    await expect(checks[0]()).resolves.toEqual({
      database: { status: 'up' },
    });
  });
});
