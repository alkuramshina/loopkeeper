import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaHealthIndicator } from './prisma-health.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
  ) {}

  @Public()
  @Get('live')
  @HealthCheck()
  checkLiveness() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @HealthCheck()
  checkReadiness() {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
    ]);
  }
}
