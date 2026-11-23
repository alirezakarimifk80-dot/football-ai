import { getFootballApiConfig } from '../../config/env.ts';
import type {
  EndpointModuleKey,
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
} from '../../types/football.ts';
import { ResilientProviderHttpClient } from '../../utils/httpClient.ts';
import { QuotaTracker } from '../../utils/quotaTracker.ts';
import type { FixtureQuery, IFootballProvider } from '../baseProvider.ts';
import {
  normalizeApiFootballCoach,
  normalizeApiFootballEvent,
  normalizeApiFootballFixture,
  normalizeApiFootballInjury,
  normalizeApiFootballLeague,
  normalizeApiFootballLineup,
  normalizeApiFootballPlayer,
  normalizeApiFootballPrediction,
  normalizeApiFootballSquad,
  normalizeApiFootballStandings,
  normalizeApiFootballStatistics,
  normalizeApiFootballTeamProfile,
  normalizeApiFootballTransfers,
} from './normalizer.ts';

interface ApiFootballResponse<T = Record<string, any>> {
  response?: T[];
  results?: number;
  errors?: Record<string, string> | string[];
}

interface ApiFootballStatusPayload {
  response?: {
    account?: { firstname?: string; lastname?: string; email?: string };
    subscription?: { plan?: string; active?: boolean };
    requests?: { current?: number; limit_day?: number };
  };
}

export class ApiFootballProvider implements IFootballProvider {
  readonly id = 'api-football' as const;
  readonly displayName = 'API-Football v3';
  readonly docsUrl = 'https://www.api-football.com/documentation-v3';
  readonly implemented = true;
  readonly supportedModules: EndpointModuleKey[] = [
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

  private readonly quotaTracker: QuotaTracker;
  private verified = false;
  private readonly fetchImpl?: typeof fetch;

  constructor(options?: { quotaTracker?: QuotaTracker; fetchImpl?: typeof fetch }) {
    const cfg = getFootballApiConfig();
    this.quotaTracker =
      options?.quotaTracker ??
      new QuotaTracker(cfg.dailyQuotaLimit, cfg.perMinuteLimit, cfg.quotaReserveBuffer);
    this.fetchImpl = options?.fetchImpl;
  }

  get baseUrl(): string {
    return getFootballApiConfig().apiFootballBaseUrl;
  }

  isConfigured(): boolean {
    return getFootballApiConfig().apiFootballKey.length > 0;
  }

  isVerified(): boolean {
    return this.verified && this.isConfigured();
  }

  getQuotaSnapshot() {
    return this.quotaTracker.getSnapshot();
  }

  private createClient(): ResilientProviderHttpClient {
    const cfg = getFootballApiConfig();
    if (!cfg.apiFootballKey) {
      throw new Error(
        'API_FOOTBALL_KEY is not configured on the server. Add it in Settings > Secrets or .env.'
      );
    }
    return new ResilientProviderHttpClient({
      baseUrl: cfg.apiFootballBaseUrl,
      headers: {
        'x-apisports-key': cfg.apiFootballKey,
      },
      timeoutMs: cfg.requestTimeoutMs,
      maxRetries: cfg.maxRetries,
      quotaTracker: this.quotaTracker,
      fetchImpl: this.fetchImpl,
    });
  }

  async testConnection(): Promise<ProviderConnectionTestResult> {
    const verifiedAt = new Date().toISOString();
    if (!this.isConfigured()) {
      this.verified = false;
      return {
        provider: this.id,
        connected: false,
        verifiedAt,
        accountName: null,
        plan: null,
        requestsToday: null,
        dailyLimit: null,
        remainingToday: null,
        error:
          'API_FOOTBALL_KEY is not configured in server environment variables. Live provider stays inactive until verified.',
      };
    }

    try {
      const client = this.createClient();
      const payload = await client.getJson<ApiFootballStatusPayload>('/status', {}, 'high');
      const info = payload.response;
      const requestsToday = info?.requests?.current ?? null;
      const dailyLimit = info?.requests?.limit_day ?? null;
      const remainingToday =
        requestsToday !== null && dailyLimit !== null ? Math.max(0, dailyLimit - requestsToday) : null;
      const active = info?.subscription?.active !== false;

      this.verified = active;
      return {
        provider: this.id,
        connected: active,
        verifiedAt,
        accountName:
          [info?.account?.firstname, info?.account?.lastname].filter(Boolean).join(' ') || null,
        plan: info?.subscription?.plan ?? null,
        requestsToday,
        dailyLimit,
        remainingToday,
        error: active ? null : 'Subscription reported as inactive by API-Football.',
      };
    } catch (err) {
      this.verified = false;
      return {
        provider: this.id,
        connected: false,
        verifiedAt,
        accountName: null,
        plan: null,
        requestsToday: null,
        dailyLimit: null,
        remainingToday: null,
        error: err instanceof Error ? err.message : 'Connection test failed',
      };
    }
  }

  async getLiveFixtures(): Promise<NormalizedFixture[]> {
    const client = this.createClient();
    const res = await client.getJson<ApiFootballResponse>('/fixtures', { live: 'all' }, 'high');
    return (res.response ?? [])
      .map(normalizeApiFootballFixture)
      .filter((x): x is NormalizedFixture => x !== null);
  }

  async getFixtures(query: FixtureQuery): Promise<NormalizedFixture[]> {
    const client = this.createClient();
    const params: Record<string, string | number | undefined> = {
      date: query.date,
      league: query.leagueId,
      season: query.season,
      team: query.teamId,
      next: query.next,
      last: query.last,
      live: query.live ? 'all' : undefined,
    };
    const res = await client.getJson<ApiFootballResponse>('/fixtures', params, 'normal');
    return (res.response ?? [])
      .map(normalizeApiFootballFixture)
      .filter((x): x is NormalizedFixture => x !== null);
  }

  async getFixtureById(fixtureId: number): Promise<NormalizedFixture | null> {
    const client = this.createClient();
    const res = await client.getJson<ApiFootballResponse>('/fixtures', { id: fixtureId }, 'high');
    const first = res.response?.[0];
    return first ? normalizeApiFootballFixture(first) : null;
  }

  async getHeadToHead(teamAId: number, teamBId: number, last = 6): Promise<NormalizedFixture[]> {
    const client = this.createClient();
    const res = await client.getJson<ApiFootballResponse>(
      '/fixtures/headtohead',
      { h2h: `${teamAId}-${teamBId}`, last },
      'low'
    );
    return (res.response ?? [])
      .map(normalizeApiFootballFixture)
      .filter((x): x is NormalizedFixture => x !== null);
  }

  async getFixtureEvents(fixtureId: number): Promise<NormalizedMatchEvent[]> {
    const client = this.createClient();
    const res = await client.getJson<ApiFootballResponse>(
      '/fixtures/events',
      { fixture: fixtureId },
      'high'
    );
    return (res.response ?? [])
      .map((item, idx) => normalizeApiFootballEvent(item, idx))
      .filter((x): x is NormalizedMatchEvent => x !== null);
  }

  async getFixtureStatistics(fixtureId: number): Promise<NormalizedTeamMatchStats[]> {
    const client = this.createClient();
    const res = await client.getJson<ApiFootballResponse>(
      '/fixtures/statistics',
      { fixture: fixtureId },
      'normal'
    );
    return (res.response ?? [])
      .map(normalizeApiFootballStatistics)
      .filter((x): x is NormalizedTeamMatchStats => x !== null);
  }

  async getFixtureLineups(fixtureId: number): Promise<NormalizedTeamLineup[]> {
    const client = this.createClient();
    const res = await client.getJson<ApiFootballResponse>(
      '/fixtures/lineups',
      { fixture: fixtureId },
      'normal'
    );
    return (res.response ?? [])
      .map(normalizeApiFootballLineup)
      .filter((x): x is NormalizedTeamLineup => x !== null);
  }

  async getLeagues(params?: { country?: string; current?: boolean }): Promise<NormalizedLeague[]> {
    const client = this.createClient();
    const res = await client.getJson<ApiFootballResponse>(
      '/leagues',
      {
        country: params?.country,
        current: params?.current ? 'true' : undefined,
      },
      'low'
    );
    return (res.response ?? [])
      .map(normalizeApiFootballLeague)
      .filter((x): x is NormalizedLeague => x !== null);
  }

  async getStandings(leagueId: number, season: number): Promise<NormalizedStandingRow[]> {
    const client = this.createClient();
    const res = await client.getJson<ApiFootballResponse>(
      '/standings',
      { league: leagueId, season },
      'normal'
    );
    return normalizeApiFootballStandings(res.response ?? []);
  }

  async getTopScorers(leagueId: number, season: number): Promise<NormalizedPlayerStats[]> {
    const client = this.createClient();
    const res = await client.getJson<ApiFootballResponse>(
      '/players/topscorers',
      { league: leagueId, season },
      'low'
    );
    return (res.response ?? [])
      .map(normalizeApiFootballPlayer)
      .filter((x): x is NormalizedPlayerStats => x !== null);
  }

  async getTopAssists(leagueId: number, season: number): Promise<NormalizedPlayerStats[]> {
    const client = this.createClient();
    const res = await client.getJson<ApiFootballResponse>(
      '/players/topassists',
      { league: leagueId, season },
      'low'
    );
    return (res.response ?? [])
      .map(normalizeApiFootballPlayer)
      .filter((x): x is NormalizedPlayerStats => x !== null);
  }

  async getTeamProfile(teamId: number): Promise<NormalizedTeamProfile | null> {
    const client = this.createClient();
    const res = await client.getJson<ApiFootballResponse>('/teams', { id: teamId }, 'low');
    const first = res.response?.[0];
    return first ? normalizeApiFootballTeamProfile(first) : null;
  }

  async getTeamSquad(teamId: number): Promise<NormalizedSquadPlayer[]> {
    const client = this.createClient();
    const res = await client.getJson<ApiFootballResponse>(
      '/players/squads',
      { team: teamId },
      'low'
    );
    return normalizeApiFootballSquad(res.response ?? []);
  }

  async getTeamStatistics(
    leagueId: number,
    season: number,
    teamId: number
  ): Promise<Record<string, unknown> | null> {
    const client = this.createClient();
    const res = await client.getJson<{ response?: Record<string, unknown> }>(
      '/teams/statistics',
      { league: leagueId, season, team: teamId },
      'low'
    );
    return res.response ?? null;
  }

  async getPlayerProfile(playerId: number, season: number): Promise<NormalizedPlayerStats | null> {
    const client = this.createClient();
    const res = await client.getJson<ApiFootballResponse>(
      '/players',
      { id: playerId, season },
      'normal'
    );
    const first = res.response?.[0];
    return first ? normalizeApiFootballPlayer(first) : null;
  }

  async getCoaches(teamId: number): Promise<NormalizedCoach[]> {
    const client = this.createClient();
    const res = await client.getJson<ApiFootballResponse>('/coachs', { team: teamId }, 'low');
    return (res.response ?? [])
      .map(normalizeApiFootballCoach)
      .filter((x): x is NormalizedCoach => x !== null);
  }

  async getTransfers(params: { teamId?: number; playerId?: number }): Promise<NormalizedTransfer[]> {
    const client = this.createClient();
    const res = await client.getJson<ApiFootballResponse>(
      '/transfers',
      { team: params.teamId, player: params.playerId },
      'low'
    );
    return normalizeApiFootballTransfers(res.response ?? []);
  }

  async getInjuries(params: {
    fixtureId?: number;
    teamId?: number;
    leagueId?: number;
    season?: number;
  }): Promise<NormalizedInjury[]> {
    const client = this.createClient();
    const res = await client.getJson<ApiFootballResponse>(
      '/injuries',
      {
        fixture: params.fixtureId,
        team: params.teamId,
        league: params.leagueId,
        season: params.season,
      },
      'low'
    );
    return (res.response ?? [])
      .map(normalizeApiFootballInjury)
      .filter((x): x is NormalizedInjury => x !== null);
  }

  async getPredictions(fixtureId: number): Promise<NormalizedPrediction | null> {
    const client = this.createClient();
    const res = await client.getJson<ApiFootballResponse>(
      '/predictions',
      { fixture: fixtureId },
      'low'
    );
    const first = res.response?.[0];
    return first ? normalizeApiFootballPrediction(first, String(fixtureId)) : null;
  }
}
