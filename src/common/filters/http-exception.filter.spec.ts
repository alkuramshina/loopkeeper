import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { DomainException } from '../exceptions/domain.exception';
import { HttpExceptionFilter } from './http-exception.filter';

type MockResponse = Pick<Response, 'status' | 'json' | 'headersSent'>;

const createHost = (response: MockResponse): ArgumentsHost =>
  ({
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  }) as unknown as ArgumentsHost;

const createResponse = (): MockResponse => {
  const response = {
    headersSent: false,
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as MockResponse;

  (response.status as jest.Mock).mockReturnValue(response);

  return response;
};

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('Database error', {
    code,
    clientVersion: 'test',
  });

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();
  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    loggerError.mockRestore();
  });

  it.each([
    [
      new BadRequestException('Invalid input'),
      HttpStatus.BAD_REQUEST,
      'validation.failed',
      'Request validation failed',
    ],
    [
      new UnauthorizedException(),
      HttpStatus.UNAUTHORIZED,
      'auth.invalid_token',
      'Authentication is required',
    ],
    [
      new NotFoundException('Campaign not found'),
      HttpStatus.NOT_FOUND,
      'resource.not_found',
      'The requested resource is unavailable',
    ],
    [
      prismaError('P2002'),
      HttpStatus.CONFLICT,
      'resource.conflict',
      'The resource conflicts with existing data',
    ],
  ])(
    'maps exceptions to a final locale-neutral response',
    (exception, statusCode, code, message) => {
      const response = createResponse();

      filter.catch(exception, createHost(response));

      expect(response.status).toHaveBeenCalledWith(statusCode);
      expect(response.json).toHaveBeenCalledWith({
        statusCode,
        code,
        message,
      });
    },
  );

  it('preserves a domain code and safe field violations', () => {
    const response = createResponse();
    const exception = new DomainException(
      HttpStatus.CONFLICT,
      'auth.email_taken',
      'Email is already registered',
      [{ field: 'email', code: 'validation.unique' }],
    );

    filter.catch(exception, createHost(response));

    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      code: 'auth.email_taken',
      message: 'Email is already registered',
      violations: [{ field: 'email', code: 'validation.unique' }],
    });
  });

  it('maps Prisma not-found errors to 404', () => {
    const response = createResponse();

    filter.catch(prismaError('P2025'), createHost(response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      code: 'resource.not_found',
      message: 'The requested resource is unavailable',
    });
  });

  it('does not expose details for unknown errors', () => {
    const response = createResponse();

    filter.catch(
      new Error('database password is secret'),
      createHost(response),
    );

    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'internal.error',
      message: 'An unexpected error occurred',
    });
  });
});
