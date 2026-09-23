import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

function routeLabel(request: Request): string {
  const routePath = request.route?.path;
  if (typeof routePath === 'string') return `${request.baseUrl}${routePath}`;
  if (request.method === 'OPTIONS') return 'preflight';
  return 'unmatched';
}

export function developmentRequestLogger(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const startedAt = performance.now();
  response.once('finish', () => {
    const durationMs = Math.round(performance.now() - startedAt);
    logger.log(
      `${request.method} ${routeLabel(request)} ${response.statusCode} ${durationMs}ms`,
    );
  });
  next();
}
