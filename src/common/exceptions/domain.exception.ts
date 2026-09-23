import { HttpException, HttpStatus } from '@nestjs/common';

export type ErrorViolation = {
  field: string;
  code: string;
};

type DomainErrorResponse = {
  code: string;
  message: string;
  violations?: ErrorViolation[];
};

export class DomainException extends HttpException {
  constructor(
    statusCode: HttpStatus,
    code: string,
    message: string,
    violations?: ErrorViolation[],
  ) {
    super(
      {
        code,
        message,
        ...(violations?.length ? { violations } : {}),
      } satisfies DomainErrorResponse,
      statusCode,
    );
  }
}
