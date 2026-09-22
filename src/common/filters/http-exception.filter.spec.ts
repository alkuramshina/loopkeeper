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
    [new BadRequestException('Invalid input'), HttpStatus.BAD_REQUEST, 'Invalid input', 'Bad Request'],
    [new UnauthorizedException(), HttpStatus.UNAUTHORIZED, 'Unauthorized', 'Unauthorized'],
    [new NotFoundException('Campaign not found'), HttpStatus.NOT_FOUND, 'Campaign not found', 'Not Found'],
    [prismaError('P2002'), HttpStatus.CONFLICT, 'A resource with this value already exists', 'Conflict'],
  ])('maps exceptions to a safe response', (exception, statusCode, message, error) => {
    const response = createResponse();

    filter.catch(exception, createHost(response));

    expect(response.status).toHaveBeenCalledWith(statusCode);
    expect(response.json).toHaveBeenCalledWith({
      statusCode,
      message,
      error,
    });
  });

  it('maps Prisma not-found errors to 404', () => {
    const response = createResponse();

    filter.catch(prismaError('P2025'), createHost(response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Resource not found',
      error: 'Not Found',
    });
  });

  it('does not expose details for unknown errors', () => {
    const response = createResponse();

    filter.catch(new Error('database password is secret'), createHost(response));

    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
  });
});
