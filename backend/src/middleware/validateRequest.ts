import type { NextFunction, Request, Response } from 'express';
import type { EndpointModuleKey, ProviderId } from '../types/football.ts';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const VALID_ENDPOINT_MODULES: EndpointModuleKey[] = [
  'live',
  'fixtures',
  'events',
  'statistics',
  'lineups',
  'h2h',
  'leagues',
  'standings',
  'topScorers',
  'topAssists',
  'teams',
  'players',
  'coaches',
  'transfers',
  'injuries',
  'predictions',
];

export const VALID_PROVIDERS: ProviderId[] = [
  'api-football',
  'football-data',
  'sportmonks',
  'openligadb',
];

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function parsePositiveIntParam(raw: unknown, fieldName: string): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const num = Number.parseInt(String(raw), 10);
  if (!Number.isInteger(num) || num <= 0 || num > 99_999_999) {
    throw new ValidationError(`Invalid positive integer for "${fieldName}"`);
  }
  return num;
}

export function parseSeasonParam(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') {
    return new Date().getUTCFullYear();
  }
  const season = Number.parseInt(String(raw), 10);
  if (!Number.isInteger(season) || season < 2000 || season > 2100) {
    throw new ValidationError('Season must be a 4-digit year between 2000 and 2100');
  }
  return season;
}

export function parseDateParam(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const str = String(raw).trim();
  if (!DATE_REGEX.test(str)) {
    throw new ValidationError('Date must use YYYY-MM-DD format');
  }
  const d = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError('Invalid calendar date');
  }
  return str;
}

export function requireIntParam(paramName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const value = parsePositiveIntParam(req.params[paramName], paramName);
      if (value === null) {
        res.status(400).json({ error: `Missing required parameter "${paramName}"` });
        return;
      }
      next();
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid parameter' });
    }
  };
}
