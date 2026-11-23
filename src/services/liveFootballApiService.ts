import type {
  ApiProviderEnvelope,
  EndpointModuleKey,
  LiveDeltaEvent,
  NormalizedCoach,
  NormalizedFixture,
  NormalizedInjury,
  NormalizedLeague,
  NormalizedMatchEvent,
  NormalizedPlayerStats,
  NormalizedPrediction,
  NormalizedSquadPlayer,
  NormalizedStandingRow,
  NormalizedTeamLineup,
  NormalizedTeamMatchStats,
  NormalizedTeamProfile,
  NormalizedTransfer,
  ProviderConnectionTestResult,
  ProviderId,
} from '../../backend/src/types/football';
import type { ProviderMetadata } from '../../backend/src/providers/baseProvider';
import type { CacheStats } from '../../backend/src/cache/cacheManager';
import type { QuotaSnapshot } from '../../backend/src/utils/quotaTracker';
import type { LiveEngineStatus } from '../../backend/src/schedulers/liveScoreEngine';
import { apiFetch } from './apiClient';

export interface AdminApiDiagnostics {
  activeProvider: ProviderId;
  activeProviderName: string;
  apiKeyStatus: { configured: boolean; masked: string };
  providers: ProviderMetadata[];
  quota: QuotaSnapshot;
  cache: CacheStats;
  enabledEndpoints: Record<EndpointModuleKey, boolean>;
  lastConnectionTest: ProviderConnectionTestResult | null;
  liveEngine: LiveEngineStatus;
  serverTimeUtc: string;
}

export function formatUtcToLocalTime(utcIso: string, lang: 'en' | 'fa'): string {
  try {
    const date = new Date(utcIso);
    if (Number.isNaN(date.getTime())) return utcIso;
    return new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return utcIso;
  }
}

export function formatUtcToLocalDateTime(utcIso: string | null, lang: 'en' | 'fa'): string {
  if (!utcIso) return lang === 'fa' ? 'هنوز ثبت نشده' : 'Never';
  try {
    const date = new Date(utcIso);
    if (Number.isNaN(date.getTime())) return utcIso;
    return new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR' : 'en-GB', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return utcIso;
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const liveFootballApiService = {
  // Real-time Server-Sent Events subscription with automatic browser reconnect
  subscribeToLiveFeed(
    onEvent: (event: LiveDeltaEvent) => void,
    onStatusChange?: (connected: boolean) => void
  ): () => void {
    const source = new EventSource(`${API_BASE}/api/v1/football/stream/live`);

    source.onopen = () => {
      onStatusChange?.(true);
    };

    source.onerror = () => {
      onStatusChange?.(false);
    };

    const handler = (ev: MessageEvent) => {
      try {
        const parsed = JSON.parse(ev.data) as LiveDeltaEvent;
        onEvent(parsed);
      } catch {
        // Ignore malformed frame
      }
    };

    source.addEventListener('football_update', handler);

    return () => {
      source.removeEventListener('football_update', handler);
      source.close();
      onStatusChange?.(false);
    };
  },

  // A–I. Football Data API v1 endpoints
  getLiveFixtures: () => apiFetch<ApiProviderEnvelope<NormalizedFixture[]>>('/api/v1/football/live'),
  getFixturesByPreset: (preset: 'yesterday' | 'today' | 'tomorrow') =>
    apiFetch<ApiProviderEnvelope<NormalizedFixture[]>>(`/api/v1/football/fixtures?preset=${preset}`),
  getFixturesByDate: (date: string) =>
    apiFetch<ApiProviderEnvelope<NormalizedFixture[]>>(`/api/v1/football/fixtures?date=${encodeURIComponent(date)}`),
  getFixtureFull: (fixtureId: number) =>
    apiFetch<{
      provider: ProviderId;
      dataSource: 'live' | 'unavailable';
      fetchedAtUtc: string;
      data: {
        fixture: NormalizedFixture | null;
        events: NormalizedMatchEvent[];
        statistics: NormalizedTeamMatchStats[];
        lineups: NormalizedTeamLineup[];
      };
    }>(`/api/v1/football/fixtures/${fixtureId}/full`),
  getHeadToHead: (teamA: number, teamB: number) =>
    apiFetch<ApiProviderEnvelope<NormalizedFixture[]>>(
      `/api/v1/football/fixtures/h2h?teamA=${teamA}&teamB=${teamB}`
    ),
  getLeagues: (current = true) =>
    apiFetch<ApiProviderEnvelope<NormalizedLeague[]>>(`/api/v1/football/leagues?current=${current}`),
  getStandings: (leagueId: number, season: number) =>
    apiFetch<ApiProviderEnvelope<NormalizedStandingRow[]>>(
      `/api/v1/football/leagues/${leagueId}/standings?season=${season}`
    ),
  getTopScorers: (leagueId: number, season: number) =>
    apiFetch<ApiProviderEnvelope<NormalizedPlayerStats[]>>(
      `/api/v1/football/leagues/${leagueId}/top-scorers?season=${season}`
    ),
  getTopAssists: (leagueId: number, season: number) =>
    apiFetch<ApiProviderEnvelope<NormalizedPlayerStats[]>>(
      `/api/v1/football/leagues/${leagueId}/top-assists?season=${season}`
    ),
  getTeamProfile: (teamId: number) =>
    apiFetch<ApiProviderEnvelope<NormalizedTeamProfile | null>>(`/api/v1/football/teams/${teamId}`),
  getTeamSquad: (teamId: number) =>
    apiFetch<ApiProviderEnvelope<NormalizedSquadPlayer[]>>(`/api/v1/football/teams/${teamId}/squad`),
  getPlayerProfile: (playerId: number, season: number) =>
    apiFetch<ApiProviderEnvelope<NormalizedPlayerStats | null>>(
      `/api/v1/football/players/${playerId}?season=${season}`
    ),
  getCoaches: (teamId: number) =>
    apiFetch<ApiProviderEnvelope<NormalizedCoach[]>>(`/api/v1/football/coaches?team=${teamId}`),
  getTransfers: (teamId: number) =>
    apiFetch<ApiProviderEnvelope<NormalizedTransfer[]>>(`/api/v1/football/transfers?team=${teamId}`),
  getInjuries: (teamId: number) =>
    apiFetch<ApiProviderEnvelope<NormalizedInjury[]>>(`/api/v1/football/injuries?team=${teamId}`),
  getPredictions: (fixtureId: number) =>
    apiFetch<ApiProviderEnvelope<NormalizedPrediction | null>>(
      `/api/v1/football/fixtures/${fixtureId}/predictions`
    ),

  // Admin API Management
  getAdminDiagnostics: () => apiFetch<AdminApiDiagnostics>('/api/v1/admin/diagnostics'),
  testConnection: (provider?: ProviderId) =>
    apiFetch<ProviderConnectionTestResult>('/api/v1/admin/test-connection', {
      method: 'POST',
      body: JSON.stringify(provider ? { provider } : {}),
    }),
  selectProvider: (provider: ProviderId) =>
    apiFetch<{ ok: boolean; message: string; activeProvider: ProviderId }>('/api/v1/admin/provider', {
      method: 'POST',
      body: JSON.stringify({ provider }),
    }),
  toggleEndpoint: (moduleKey: EndpointModuleKey, enabled: boolean) =>
    apiFetch<{ ok: boolean; enabledEndpoints: Record<EndpointModuleKey, boolean> }>(
      '/api/v1/admin/endpoints',
      {
        method: 'PATCH',
        body: JSON.stringify({ moduleKey, enabled }),
      }
    ),
  clearCache: () =>
    apiFetch<{ ok: boolean; clearedEntries: number }>('/api/v1/admin/cache/clear', {
      method: 'POST',
    }),
  controlLiveEngine: (payload: { action?: 'start' | 'stop' | 'poll_now'; pollIntervalSec?: number }) =>
    apiFetch<{ ok: boolean; liveEngine: LiveEngineStatus }>('/api/v1/admin/live-engine', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
