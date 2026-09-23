import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorViolationDto {
  @ApiProperty({ example: 'email' })
  field!: string;

  @ApiProperty({ example: 'validation.invalid_format' })
  code!: string;
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'validation.failed' })
  code!: string;

  @ApiProperty({ example: 'Request validation failed' })
  message!: string;

  @ApiPropertyOptional({ type: [ApiErrorViolationDto] })
  violations?: ApiErrorViolationDto[];
}
