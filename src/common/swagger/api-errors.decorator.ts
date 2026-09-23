import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from './error-response.dto';

export function ApiCommonErrors(options: {
  badRequest?: boolean;
  conflict?: boolean;
  notFound?: boolean;
  unauthorized?: boolean;
} = {}) {
  const {
    badRequest = true,
    conflict = false,
    notFound = true,
    unauthorized = true,
  } = options;

  return applyDecorators(
    ...(badRequest ? [ApiBadRequestResponse({ type: ApiErrorResponseDto, description: 'Validation failed.' })] : []),
    ...(unauthorized ? [ApiUnauthorizedResponse({ type: ApiErrorResponseDto, description: 'Authentication is required or invalid.' })] : []),
    ...(notFound ? [ApiNotFoundResponse({ type: ApiErrorResponseDto, description: 'The resource is unavailable or outside the tenant boundary.' })] : []),
    ...(conflict ? [ApiConflictResponse({ type: ApiErrorResponseDto, description: 'The request conflicts with existing state.' })] : []),
  );
}
