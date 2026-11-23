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
  ProviderId,
} from '../types/football.ts';
import type { QuotaSnapshot } from '../utils/quotaTracker.ts';

export interface ProviderMetadata {
  id: ProviderId;
  displayName: string;
  baseUrl: string;
  docsUrl: string;
  implemented: boolean;
  configured: boolean;
  verified: boolean;
  supportedModules: EndpointModuleKey[];
}

export interface FixtureQuery {
  date?: string; // YYYY-MM-DD
  leagueId?: number;
  season?: number;
  teamId?: number;
  next?: number;
  last?: number;
  live?: boolean;
}

export interface IFootballProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly baseUrl: string;
  readonly docsUrl: string;
  readonly implemented: boolean;
  readonly supportedModules: EndpointModuleKey[];

  isConfigured(): boolean;
  isVerified(): boolean;
  getQuotaSnapshot(): QuotaSnapshot;
  testConnection(): Promise<ProviderConnectionTestResult>;

  // A & B. Live scores & fixtures
  getLiveFixtures(): Promise<NormalizedFixture[]>;
  getFixtures(query: FixtureQuery): Promise<NormalizedFixture[]>;
  getFixtureById(fixtureId: number): Promise<NormalizedFixture | null>;
  getHeadToHead(teamAId: number, teamBId: number, last?: number): Promise<NormalizedFixture[]>;

  // C, D, E. Match details
  getFixtureEvents(fixtureId: number): Promise<NormalizedMatchEvent[]>;
  getFixtureStatistics(fixtureId: number): Promise<NormalizedTeamMatchStats[]>;
  getFixtureLineups(fixtureId: number): Promise<NormalizedTeamLineup[]>;

  // F. Leagues
  getLeagues(params?: { country?: string; current?: boolean }): Promise<NormalizedLeague[]>;
  getStandings(leagueId: number, season: number): Promise<NormalizedStandingRow[]>;
  getTopScorers(leagueId: number, season: number): Promise<NormalizedPlayerStats[]>;
  getTopAssists(leagueId: number, season: number): Promise<NormalizedPlayerStats[]>;

  // G. Teams
  getTeamProfile(teamId: number): Promise<NormalizedTeamProfile | null>;
  getTeamSquad(teamId: number): Promise<NormalizedSquadPlayer[]>;
  getTeamStatistics(leagueId: number, season: number, teamId: number): Promise<Record<string, unknown> | null>;

  // H. Players
  getPlayerProfile(playerId: number, season: number): Promise<NormalizedPlayerStats | null>;

  // I. Other football data
  getCoaches(teamId: number): Promise<NormalizedCoach[]>;
  getTransfers(params: { teamId?: number; playerId?: number }): Promise<NormalizedTransfer[]>;
  getInjuries(params: { fixtureId?: number; teamId?: number; leagueId?: number; season?: number }): Promise<NormalizedInjury[]>;
  getPredictions(fixtureId: number): Promise<NormalizedPrediction | null>;
}

/**
 * Unverified scaffold provider for future adapters (Sportmonks, football-data.org, OpenLigaDB).
 * Prevents accidental activation before credentials, schema mapping, and subscription coverage are verified.
 */
export class ScaffoldProvider implements IFootballProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly baseUrl: string;
  readonly docsUrl: string;
  readonly implemented = false;
  readonly supportedModules: EndpointModuleKey[] = [];

  constructor(id: ProviderId, displayName: string, baseUrl: string, docsUrl: string) {
    this.id = id;
    this.displayName = displayName;
    this.baseUrl = baseUrl;
    this.docsUrl = docsUrl;
  }

  isConfigured(): boolean {
    return false;
  }

  isVerified(): boolean {
    return false;
  }

  getQuotaSnapshot(): QuotaSnapshot {
    return {
      dayKeyUtc: new Date().toISOString().slice(0, 10),
      requestsToday: 0,
      dailyLimit: 0,
      remainingToday: 0,
      requestsLastMinute: 0,
      perMinuteLimit: 0,
      backoffUntilUtc: null,
      isBackoffActive: false,
      lastSuccessfulSyncUtc: null,
      recentErrors: [],
    };
  }

  async testConnection(): Promise<ProviderConnectionTestResult> {
    return {
      provider: this.id,
      connected: false,
      verifiedAt: new Date().toISOString(),
      accountName: null,
      plan: null,
      requestsToday: null,
      dailyLimit: null,
      remainingToday: null,
      error: `${this.displayName} adapter is scaffolded for future integration and has not been verified yet.`,
    };
  }

  private notImplemented(): never {
    throw new Error(`${this.displayName} provider is not activated or verified.`);
  }

  getLiveFixtures(): Promise<NormalizedFixture[]> { this.notImplemented(); }
  getFixtures(): Promise<NormalizedFixture[]> { this.notImplemented(); }
  getFixtureById(): Promise<NormalizedFixture | null> { this.notImplemented(); }
  getHeadToHead(): Promise<NormalizedFixture[]> { this.notImplemented(); }
  getFixtureEvents(): Promise<NormalizedMatchEvent[]> { this.notImplemented(); }
  getFixtureStatistics(): Promise<NormalizedTeamMatchStats[]> { this.notImplemented(); }
  getFixtureLineups(): Promise<NormalizedTeamLineup[]> { this.notImplemented(); }
  getLeagues(): Promise<NormalizedLeague[]> { this.notImplemented(); }
  getStandings(): Promise<NormalizedStandingRow[]> { this.notImplemented(); }
  getTopScorers(): Promise<NormalizedPlayerStats[]> { this.notImplemented(); }
  getTopAssists(): Promise<NormalizedPlayerStats[]> { this.notImplemented(); }
  getTeamProfile(): Promise<NormalizedTeamProfile | null> { this.notImplemented(); }
  getTeamSquad(): Promise<NormalizedSquadPlayer[]> { this.notImplemented(); }
  getTeamStatistics(): Promise<Record<string, unknown> | null> { this.notImplemented(); }
  getPlayerProfile(): Promise<NormalizedPlayerStats | null> { this.notImplemented(); }
  getCoaches(): Promise<NormalizedCoach[]> { this.notImplemented(); }
  getTransfers(): Promise<NormalizedTransfer[]> { this.notImplemented(); }
  getInjuries(): Promise<NormalizedInjury[]> { this.notImplemented(); }
  getPredictions(): Promise<NormalizedPrediction | null> { this.notImplemented(); }
}
