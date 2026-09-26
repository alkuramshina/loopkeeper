import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaHealthIndicator } from './prisma-health.indicator';
import {
  LivenessResponseDto,
  ReadinessResponseDto,
} from './dto/health-response.dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
  ) {}

  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Check whether the service is running' })
  @ApiOkResponse({ type: LivenessResponseDto })
  @Get('live')
  @HealthCheck()
  checkLiveness() {
    return { status: 'ok' };
  }

  @Public()
  @SkipThrottle()
  @ApiOperation({
    summary: 'Check whether the service is ready to accept traffic',
  })
  @ApiOkResponse({ type: ReadinessResponseDto })
  @Get('ready')
  @HealthCheck()
  checkReadiness() {
    return this.health.check([() => this.prismaHealth.isHealthy('database')]);
  }
}
