import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../common/swagger/error-response.dto';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaHealthIndicator } from './prisma-health.indicator';
import { MediaHealthIndicator } from './media-health.indicator';
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
    private readonly mediaHealth: MediaHealthIndicator,
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
  @ApiServiceUnavailableResponse({
    type: ApiErrorResponseDto,
    description:
      'A dependency is unavailable; no storage configuration is exposed.',
  })
  @Get('ready')
  @HealthCheck()
  checkReadiness() {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.mediaHealth.isHealthy('media'),
    ]);
  }
}
