import { ApiProperty } from '@nestjs/swagger';

export class LivenessResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;
}

export class HealthIndicatorResponseDto {
  @ApiProperty({ example: 'up' })
  status!: string;
}

export class ReadinessResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: { status: { type: 'string', example: 'up' } },
    },
  })
  info!: Record<string, HealthIndicatorResponseDto>;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: { status: { type: 'string', example: 'down' } },
    },
  })
  error!: Record<string, HealthIndicatorResponseDto>;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: { status: { type: 'string', example: 'up' } },
    },
  })
  details!: Record<string, HealthIndicatorResponseDto>;
}
