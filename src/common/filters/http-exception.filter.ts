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

type ErrorResponse = {
  statusCode: number;
  message: string | string[];
  error: string;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (response.headersSent) {
      return;
    }

    const errorResponse = this.toErrorResponse(exception);

    if (!(exception instanceof HttpException)) {
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
          'A resource with this value already exists',
        );
      }

      if (exception.code === 'P2025') {
        return this.createResponse(HttpStatus.NOT_FOUND, 'Resource not found');
      }

      return this.createResponse(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Internal server error',
      );
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        return this.createResponse(statusCode, exceptionResponse);
      }

      const { message, error } = exceptionResponse as Partial<ErrorResponse>;

      return {
        statusCode,
        message: message ?? this.getStatusError(statusCode),
        error: error ?? this.getStatusError(statusCode),
      };
    }

    return this.createResponse(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Internal server error',
    );
  }

  private createResponse(
    statusCode: HttpStatus,
    message: string,
  ): ErrorResponse {
    return {
      statusCode,
      message,
      error: this.getStatusError(statusCode),
    };
  }

  private getStatusError(statusCode: number): string {
    return HttpStatus[statusCode]
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
