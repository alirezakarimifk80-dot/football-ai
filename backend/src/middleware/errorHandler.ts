import type { NextFunction, Request, Response } from 'express';
import {
  EndpointDisabledError,
  ProviderNotConfiguredError,
} from '../services/footballDataService.ts';
import { ProviderHttpError } from '../utils/httpClient.ts';
import { ValidationError } from './validateRequest.ts';

export function footballApiErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ValidationError) {
    res.status(400).json({
      error: err.message,
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  if (err instanceof ProviderNotConfiguredError) {
    res.status(503).json({
      error: err.message,
      code: 'PROVIDER_NOT_CONFIGURED',
      dataSource: 'unavailable',
    });
    return;
  }

  if (err instanceof EndpointDisabledError) {
    res.status(403).json({
      error: err.message,
      code: 'ENDPOINT_DISABLED',
      dataSource: 'unavailable',
    });
    return;
  }

  if (err instanceof ProviderHttpError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.statusCode === 429 ? 'RATE_LIMITED' : 'UPSTREAM_PROVIDER_ERROR',
      endpoint: err.endpoint,
      dataSource: 'unavailable',
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Unexpected football API error';
  res.status(500).json({
    error: message,
    code: 'INTERNAL_ERROR',
  });
}
