import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { ErrorViolation } from '../exceptions/domain.exception';

type ErrorResponse = {
  statusCode: number;
  code: string;
  message: string;
  violations?: ErrorViolation[];
};

type HttpExceptionResponse = Partial<Omit<ErrorResponse, 'statusCode'>>;

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (response.headersSent) {
      return;
    }

    const errorResponse = this.toErrorResponse(exception);

    if (!this.isExpectedException(exception)) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private toErrorResponse(exception: unknown): ErrorResponse {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return this.createResponse(
          HttpStatus.CONFLICT,
          'resource.conflict',
          'The resource conflicts with existing data',
        );
      }

      if (exception.code === 'P2025') {
        return this.createResponse(
          HttpStatus.NOT_FOUND,
          'resource.not_found',
          'The requested resource is unavailable',
        );
      }
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse !== 'string') {
        const { code, message, violations } =
          exceptionResponse as HttpExceptionResponse;

        const hasStableCode = this.isStableCode(code);

        return this.createResponse(
          statusCode,
          hasStableCode ? code : this.defaultCodeForStatus(statusCode),
          hasStableCode && typeof message === 'string'
            ? message
            : this.defaultMessageForStatus(statusCode),
          this.isValidViolations(violations) ? violations : undefined,
        );
      }

      return this.createResponse(
        statusCode,
        this.defaultCodeForStatus(statusCode),
        this.defaultMessageForStatus(statusCode),
      );
    }

    return this.createResponse(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'internal.error',
      'An unexpected error occurred',
    );
  }

  private isExpectedException(exception: unknown): boolean {
    return (
      exception instanceof HttpException ||
      (exception instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2025'].includes(exception.code))
    );
  }

  private createResponse(
    statusCode: number,
    code: string,
    message: string,
    violations?: ErrorViolation[],
  ): ErrorResponse {
    return {
      statusCode,
      code,
      message,
      ...(violations?.length ? { violations } : {}),
    };
  }

  private defaultCodeForStatus(statusCode: number): string {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return 'validation.failed';
      case HttpStatus.UNAUTHORIZED:
        return 'auth.invalid_token';
      case HttpStatus.FORBIDDEN:
        return 'resource.access_denied';
      case HttpStatus.NOT_FOUND:
        return 'resource.not_found';
      case HttpStatus.CONFLICT:
        return 'resource.conflict';
      default:
        return 'internal.error';
    }
  }

  private defaultMessageForStatus(statusCode: number): string {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return 'Request validation failed';
      case HttpStatus.UNAUTHORIZED:
        return 'Authentication is required';
      case HttpStatus.FORBIDDEN:
        return 'The requested action is not allowed';
      case HttpStatus.NOT_FOUND:
        return 'The requested resource is unavailable';
      case HttpStatus.CONFLICT:
        return 'The resource conflicts with existing data';
      default:
        return 'An unexpected error occurred';
    }
  }

  private isStableCode(value: unknown): value is string {
    return typeof value === 'string' && /^[a-z]+(?:[._][a-z]+)*$/.test(value);
  }

  private isValidViolations(
    violations: unknown,
  ): violations is ErrorViolation[] {
    return (
      Array.isArray(violations) &&
      violations.every(
        (violation) =>
          typeof violation === 'object' &&
          violation !== null &&
          typeof violation.field === 'string' &&
          typeof violation.code === 'string',
      )
    );
  }
}
