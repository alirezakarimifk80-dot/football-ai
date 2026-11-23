import { sharedCache, type CacheManager } from '../cache/cacheManager.ts';
import { getFootballApiConfig, getMaskedKeyStatus } from '../config/env.ts';
import { ApiFootballProvider } from '../providers/apiFootball/apiFootballProvider.ts';
import {
  ScaffoldProvider,
  type FixtureQuery,
  type IFootballProvider,
  type ProviderMetadata,
} from '../providers/baseProvider.ts';
import type {
  ApiProviderEnvelope,
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
  ProviderId,
} from '../types/football.ts';

export class EndpointDisabledError extends Error {
  constructor(moduleKey: EndpointModuleKey) {
    super(`Endpoint module "${moduleKey}" is currently disabled in Admin API settings.`);
    this.name = 'EndpointDisabledError';
  }
}

export class ProviderNotConfiguredError extends Error {
  constructor(providerName: string) {
    super(
      `${providerName} is not configured on the server. Set API_FOOTBALL_KEY in environment secrets and run Connection Test.`
    );
    this.name = 'ProviderNotConfiguredError';
  }
}

export class FootballDataService {
  private readonly providers = new Map<ProviderId, IFootballProvider>();
  private activeProviderId: ProviderId = 'api-football';
  private readonly cache: CacheManager;
  private lastConnectionTest: ProviderConnectionTestResult | null = null;
  private enabledEndpoints: Record<EndpointModuleKey, boolean> = {
    live: true,
    fixtures: true,
    events: true,
    statistics: true,
    lineups: true,
    h2h: true,
    leagues: true,
    standings: true,
    topScorers: true,
    topAssists: true,
    teams: true,
    players: true,
    coaches: true,
    transfers: true,
    injuries: true,
    predictions: false, // Disabled by default on free tier to save quota unless opted-in
  };

  constructor(options?: { primaryProvider?: IFootballProvider; cache?: CacheManager }) {
    this.cache = options?.cache ?? sharedCache;

    const primary = options?.primaryProvider ?? new ApiFootballProvider();
    this.providers.set(primary.id, primary);

    // Register future provider scaffolds (cannot be activated until implemented & verified)
    this.providers.set(
      'football-data',
      new ScaffoldProvider(
        'football-data',
        'football-data.org v4',
        'https://api.football-data.org',
        'https://www.football-data.org/documentation/quickstart'
      )
    );
    this.providers.set(
      'sportmonks',
      new ScaffoldProvider(
        'sportmonks',
        'Sportmonks Football v3',
        'https://api.sportmonks.com',
        'https://docs.sportmonks.com/football'
      )
    );
    this.providers.set(
      'openligadb',
      new ScaffoldProvider(
        'openligadb',
        'OpenLigaDB',
        'https://api.openligadb.de',
        'https://api.openligadb.de'
      )
    );
  }

  getActiveProvider(): IFootballProvider {
    return this.providers.get(this.activeProviderId)!;
  }

  listProviders(): ProviderMetadata[] {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      displayName: p.displayName,
      baseUrl: p.baseUrl,
      docsUrl: p.docsUrl,
      implemented: p.implemented,
      configured: p.isConfigured(),
      verified: p.isVerified(),
      supportedModules: p.supportedModules,
    }));
  }

  selectProvider(providerId: ProviderId): { switched: boolean; message: string } {
    const target = this.providers.get(providerId);
    if (!target) {
      return { switched: false, message: `Unknown provider: ${providerId}` };
    }
    if (!target.implemented) {
      return {
        switched: false,
        message: `${target.displayName} is a future adapter scaffold and cannot be activated until implemented and verified.`,
      };
    }
    if (!target.isConfigured()) {
      return {
        switched: false,
        message: `${target.displayName} API key is not configured on the server.`,
      };
    }
    this.activeProviderId = providerId;
    return { switched: true, message: `Active provider set to ${target.displayName}.` };
  }

  getEnabledEndpoints(): Record<EndpointModuleKey, boolean> {
    return { ...this.enabledEndpoints };
  }

  setEndpointEnabled(moduleKey: EndpointModuleKey, enabled: boolean): Record<EndpointModuleKey, boolean> {
    this.enabledEndpoints[moduleKey] = enabled;
    return this.getEnabledEndpoints();
  }

  clearCache(): number {
    return this.cache.clear();
  }

  async testConnection(providerId?: ProviderId): Promise<ProviderConnectionTestResult> {
    const provider = providerId ? this.providers.get(providerId) : this.getActiveProvider();
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }
    const result = await provider.testConnection();
    if (provider.id === this.activeProviderId) {
      this.lastConnectionTest = result;
    }
    return result;
  }

  getDiagnostics() {
    const cfg = getFootballApiConfig();
    const active = this.getActiveProvider();
    const keyStatus = getMaskedKeyStatus(cfg.apiFootballKey);
    return {
      activeProvider: active.id,
      activeProviderName: active.displayName,
      apiKeyStatus: keyStatus,
      providers: this.listProviders(),
      quota: active.getQuotaSnapshot(),
      cache: this.cache.getStats(),
      enabledEndpoints: this.getEnabledEndpoints(),
      lastConnectionTest: this.lastConnectionTest,
      cacheTtlSec: cfg.cacheTtlSec,
    };
  }

  private assertModuleReady(moduleKey: EndpointModuleKey): IFootballProvider {
    if (!this.enabledEndpoints[moduleKey]) {
      throw new EndpointDisabledError(moduleKey);
    }
    const provider = this.getActiveProvider();
    if (!provider.isConfigured()) {
      throw new ProviderNotConfiguredError(provider.displayName);
    }
    return provider;
  }

  private async cachedCall<T>(
    moduleKey: EndpointModuleKey,
    cacheKey: string,
    ttlSeconds: number,
    tags: string[],
    fn: (provider: IFootballProvider) => Promise<T>
  ): Promise<ApiProviderEnvelope<T>> {
    const provider = this.assertModuleReady(moduleKey);
    const { value, cached } = await this.cache.getOrFetch(
      `${provider.id}:${cacheKey}`,
      ttlSeconds,
      () => fn(provider),
      tags
    );
    return {
      provider: provider.id,
      dataSource: 'live',
      cached,
      fetchedAtUtc: new Date().toISOString(),
      data: value,
    };
  }

  // A. Live scores
  getLiveFixtures(): Promise<ApiProviderEnvelope<NormalizedFixture[]>> {
    const ttl = getFootballApiConfig().cacheTtlSec.live;
    return this.cachedCall('live', 'fixtures:live', ttl, ['live'], (p) => p.getLiveFixtures());
  }

  // B. Fixtures & H2H
  getFixtures(query: FixtureQuery): Promise<ApiProviderEnvelope<NormalizedFixture[]>> {
    const ttl = query.live
      ? getFootballApiConfig().cacheTtlSec.live
      : getFootballApiConfig().cacheTtlSec.fixtures;
    const key = `fixtures:${JSON.stringify(query)}`;
    return this.cachedCall('fixtures', key, ttl, ['fixtures'], (p) => p.getFixtures(query));
  }

  getFixtureById(fixtureId: number): Promise<ApiProviderEnvelope<NormalizedFixture | null>> {
    const ttl = getFootballApiConfig().cacheTtlSec.live;
    return this.cachedCall('fixtures', `fixture:${fixtureId}`, ttl, ['fixtures'], (p) =>
      p.getFixtureById(fixtureId)
    );
  }

  getHeadToHead(
    teamAId: number,
    teamBId: number,
    last = 6
  ): Promise<ApiProviderEnvelope<NormalizedFixture[]>> {
    const ttl = getFootballApiConfig().cacheTtlSec.h2h;
    const sortedPair = [teamAId, teamBId].sort((a, b) => a - b).join('-');
    return this.cachedCall('h2h', `h2h:${sortedPair}:${last}`, ttl, ['h2h'], (p) =>
      p.getHeadToHead(teamAId, teamBId, last)
    );
  }

  // C. Match events
  getFixtureEvents(fixtureId: number): Promise<ApiProviderEnvelope<NormalizedMatchEvent[]>> {
    const ttl = getFootballApiConfig().cacheTtlSec.events;
    return this.cachedCall('events', `events:${fixtureId}`, ttl, ['events', `f:${fixtureId}`], (p) =>
      p.getFixtureEvents(fixtureId)
    );
  }

  // D. Match statistics
  getFixtureStatistics(fixtureId: number): Promise<ApiProviderEnvelope<NormalizedTeamMatchStats[]>> {
    const ttl = getFootballApiConfig().cacheTtlSec.statistics;
    return this.cachedCall(
      'statistics',
      `stats:${fixtureId}`,
      ttl,
      ['statistics', `f:${fixtureId}`],
      (p) => p.getFixtureStatistics(fixtureId)
    );
  }

  // E. Lineups
  getFixtureLineups(fixtureId: number): Promise<ApiProviderEnvelope<NormalizedTeamLineup[]>> {
    const ttl = getFootballApiConfig().cacheTtlSec.lineups;
    return this.cachedCall(
      'lineups',
      `lineups:${fixtureId}`,
      ttl,
      ['lineups', `f:${fixtureId}`],
      (p) => p.getFixtureLineups(fixtureId)
    );
  }

  // F. Leagues & standings
  getLeagues(params?: { country?: string; current?: boolean }): Promise<ApiProviderEnvelope<NormalizedLeague[]>> {
    const ttl = getFootballApiConfig().cacheTtlSec.leagues;
    return this.cachedCall(
      'leagues',
      `leagues:${params?.country ?? 'all'}:${params?.current ? '1' : '0'}`,
      ttl,
      ['leagues'],
      (p) => p.getLeagues(params)
    );
  }

  getStandings(leagueId: number, season: number): Promise<ApiProviderEnvelope<NormalizedStandingRow[]>> {
    const ttl = getFootballApiConfig().cacheTtlSec.standings;
    return this.cachedCall(
      'standings',
      `standings:${leagueId}:${season}`,
      ttl,
      ['standings'],
      (p) => p.getStandings(leagueId, season)
    );
  }

  getTopScorers(leagueId: number, season: number): Promise<ApiProviderEnvelope<NormalizedPlayerStats[]>> {
    const ttl = getFootballApiConfig().cacheTtlSec.standings;
    return this.cachedCall(
      'topScorers',
      `topscorers:${leagueId}:${season}`,
      ttl,
      ['topScorers'],
      (p) => p.getTopScorers(leagueId, season)
    );
  }

  getTopAssists(leagueId: number, season: number): Promise<ApiProviderEnvelope<NormalizedPlayerStats[]>> {
    const ttl = getFootballApiConfig().cacheTtlSec.standings;
    return this.cachedCall(
      'topAssists',
      `topassists:${leagueId}:${season}`,
      ttl,
      ['topAssists'],
      (p) => p.getTopAssists(leagueId, season)
    );
  }

  // G. Teams
  getTeamProfile(teamId: number): Promise<ApiProviderEnvelope<NormalizedTeamProfile | null>> {
    const ttl = getFootballApiConfig().cacheTtlSec.teams;
    return this.cachedCall('teams', `team:${teamId}`, ttl, ['teams'], (p) =>
      p.getTeamProfile(teamId)
    );
  }

  getTeamSquad(teamId: number): Promise<ApiProviderEnvelope<NormalizedSquadPlayer[]>> {
    const ttl = getFootballApiConfig().cacheTtlSec.teams;
    return this.cachedCall('teams', `squad:${teamId}`, ttl, ['teams'], (p) =>
      p.getTeamSquad(teamId)
    );
  }

  getTeamStatistics(
    leagueId: number,
    season: number,
    teamId: number
  ): Promise<ApiProviderEnvelope<Record<string, unknown> | null>> {
    const ttl = getFootballApiConfig().cacheTtlSec.teams;
    return this.cachedCall(
      'teams',
      `teamstats:${leagueId}:${season}:${teamId}`,
      ttl,
      ['teams'],
      (p) => p.getTeamStatistics(leagueId, season, teamId)
    );
  }

  // H. Players
  getPlayerProfile(
    playerId: number,
    season: number
  ): Promise<ApiProviderEnvelope<NormalizedPlayerStats | null>> {
    const ttl = getFootballApiConfig().cacheTtlSec.players;
    return this.cachedCall('players', `player:${playerId}:${season}`, ttl, ['players'], (p) =>
      p.getPlayerProfile(playerId, season)
    );
  }

  // I. Other football data
  getCoaches(teamId: number): Promise<ApiProviderEnvelope<NormalizedCoach[]>> {
    const ttl = getFootballApiConfig().cacheTtlSec.coaches;
    return this.cachedCall('coaches', `coaches:${teamId}`, ttl, ['coaches'], (p) =>
      p.getCoaches(teamId)
    );
  }

  getTransfers(params: {
    teamId?: number;
    playerId?: number;
  }): Promise<ApiProviderEnvelope<NormalizedTransfer[]>> {
    const ttl = getFootballApiConfig().cacheTtlSec.transfers;
    return this.cachedCall(
      'transfers',
      `transfers:${params.teamId ?? ''}:${params.playerId ?? ''}`,
      ttl,
      ['transfers'],
      (p) => p.getTransfers(params)
    );
  }

  getInjuries(params: {
    fixtureId?: number;
    teamId?: number;
    leagueId?: number;
    season?: number;
  }): Promise<ApiProviderEnvelope<NormalizedInjury[]>> {
    const ttl = getFootballApiConfig().cacheTtlSec.injuries;
    return this.cachedCall(
      'injuries',
      `injuries:${JSON.stringify(params)}`,
      ttl,
      ['injuries'],
      (p) => p.getInjuries(params)
    );
  }

  getPredictions(fixtureId: number): Promise<ApiProviderEnvelope<NormalizedPrediction | null>> {
    const ttl = getFootballApiConfig().cacheTtlSec.predictions;
    return this.cachedCall(
      'predictions',
      `predictions:${fixtureId}`,
      ttl,
      ['predictions'],
      (p) => p.getPredictions(fixtureId)
    );
  }
}

export const footballDataService = new FootballDataService();
