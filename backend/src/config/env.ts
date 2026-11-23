export interface FootballApiEnvConfig {
  apiFootballKey: string;
  apiFootballBaseUrl: string;
  dailyQuotaLimit: number;
  perMinuteLimit: number;
  quotaReserveBuffer: number;
  requestTimeoutMs: number;
  maxRetries: number;
  livePollIntervalSec: number;
  cacheTtlSec: {
    live: number;
    fixtures: number;
    events: number;
    statistics: number;
    lineups: number;
    standings: number;
    leagues: number;
    teams: number;
    players: number;
    h2h: number;
    injuries: number;
    transfers: number;
    coaches: number;
    predictions: number;
  };
  redisUrl: string;
}

export const ALLOWED_PROVIDER_HOSTS = new Set<string>([
  'v3.football.api-sports.io',
  'api.football-data.org',
  'api.sportmonks.com',
  'api.openligadb.de',
  'site.api.espn.com',
  'www.fotmob.com',
]);

function parsePositiveInt(val: string | undefined, fallback: number, min = 1, max = 86400): number {
  if (!val) return fallback;
  const parsed = Number.parseInt(val, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

export function validateProviderBaseUrl(rawUrl: string): string {
  const fallback = 'https://v3.football.api-sports.io';
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return fallback;
    if (!ALLOWED_PROVIDER_HOSTS.has(parsed.hostname.toLowerCase())) return fallback;
    return parsed.origin;
  } catch {
    return fallback;
  }
}

export function getFootballApiConfig(): FootballApiEnvConfig {
  const rawKey = (process.env.API_FOOTBALL_KEY ?? process.env.FOOTBALL_API_KEY ?? '').trim();
  const apiFootballKey = rawKey === 'MY_API_FOOTBALL_KEY' ? '' : rawKey;
  const rawBaseUrl =
    process.env.API_FOOTBALL_BASE_URL ??
    process.env.FOOTBALL_API_BASE_URL ??
    'https://v3.football.api-sports.io';

  return {
    apiFootballKey,
    apiFootballBaseUrl: validateProviderBaseUrl(rawBaseUrl),
    dailyQuotaLimit: parsePositiveInt(process.env.API_FOOTBALL_DAILY_LIMIT, 100, 10, 100000),
    perMinuteLimit: parsePositiveInt(process.env.API_FOOTBALL_PER_MINUTE_LIMIT, 10, 1, 600),
    quotaReserveBuffer: parsePositiveInt(process.env.API_FOOTBALL_QUOTA_BUFFER, 5, 0, 50),
    requestTimeoutMs: parsePositiveInt(process.env.API_FOOTBALL_TIMEOUT_MS, 10000, 1000, 30000),
    maxRetries: parsePositiveInt(process.env.API_FOOTBALL_MAX_RETRIES, 2, 0, 5),
    livePollIntervalSec: parsePositiveInt(process.env.LIVE_POLL_INTERVAL_SECONDS, 60, 15, 600),
    cacheTtlSec: {
      live: parsePositiveInt(process.env.CACHE_TTL_LIVE_SEC, 45, 10, 300),
      fixtures: parsePositiveInt(process.env.CACHE_TTL_FIXTURES_SEC, 300, 30, 3600),
      events: parsePositiveInt(process.env.CACHE_TTL_EVENTS_SEC, 45, 15, 300),
      statistics: parsePositiveInt(process.env.CACHE_TTL_STATS_SEC, 60, 15, 600),
      lineups: parsePositiveInt(process.env.CACHE_TTL_LINEUPS_SEC, 600, 60, 7200),
      standings: parsePositiveInt(process.env.CACHE_TTL_STANDINGS_SEC, 1800, 120, 43200),
      leagues: parsePositiveInt(process.env.CACHE_TTL_LEAGUES_SEC, 86400, 300, 86400),
      teams: parsePositiveInt(process.env.CACHE_TTL_TEAMS_SEC, 21600, 300, 86400),
      players: parsePositiveInt(process.env.CACHE_TTL_PLAYERS_SEC, 21600, 300, 86400),
      h2h: parsePositiveInt(process.env.CACHE_TTL_H2H_SEC, 43200, 300, 86400),
      injuries: parsePositiveInt(process.env.CACHE_TTL_INJURIES_SEC, 7200, 300, 86400),
      transfers: parsePositiveInt(process.env.CACHE_TTL_TRANSFERS_SEC, 43200, 300, 86400),
      coaches: parsePositiveInt(process.env.CACHE_TTL_COACHES_SEC, 43200, 300, 86400),
      predictions: parsePositiveInt(process.env.CACHE_TTL_PREDICTIONS_SEC, 3600, 300, 86400),
    },
    redisUrl: (process.env.REDIS_URL ?? '').trim(),
  };
}

export function getMaskedKeyStatus(key: string): { configured: boolean; masked: string } {
  if (!key) {
    return { configured: false, masked: 'Not configured' };
  }
  const suffix = key.length >= 4 ? key.slice(-4) : '****';
  return { configured: true, masked: `••••••••${suffix}` };
}
