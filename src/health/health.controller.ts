import { Controller, Get } from '@nestjs/common';
import { HealthCheck } from '@nestjs/terminus';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @HealthCheck()
  check() {
    return {
      "status": "ok",
      "error": {},
    };
  }
}
