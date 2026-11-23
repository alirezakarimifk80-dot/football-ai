export type ProviderId = 'api-football' | 'sportmonks' | 'football-data' | 'openligadb';

export type NormalizedMatchPhase =
  | 'NS'       // Not started / scheduled
  | '1H'       // First half
  | 'HT'       // Half-time
  | '2H'       // Second half
  | 'ET'       // Extra time
  | 'BT'       // Break time (before extra time)
  | 'P'        // Penalty shootout in progress
  | 'FT'       // Full time
  | 'AET'      // After extra time
  | 'PEN'      // Finished after penalties
  | 'PST'      // Postponed
  | 'CANC'     // Cancelled
  | 'ABD'      // Abandoned
  | 'SUSP'     // Suspended
  | 'TBD';     // Time to be defined

export type MatchBucket = 'LIVE' | 'HT' | 'FT' | 'UPCOMING' | 'POSTPONED' | 'CANCELLED';

export type EndpointModuleKey =
  | 'live'
  | 'fixtures'
  | 'events'
  | 'statistics'
  | 'lineups'
  | 'h2h'
  | 'leagues'
  | 'standings'
  | 'topScorers'
  | 'topAssists'
  | 'teams'
  | 'players'
  | 'coaches'
  | 'transfers'
  | 'injuries'
  | 'predictions';

export interface NormalizedScoreBreakdown {
  halftime: { home: number | null; away: number | null };
  fulltime: { home: number | null; away: number | null };
  extratime: { home: number | null; away: number | null };
  penalty: { home: number | null; away: number | null };
}

export interface NormalizedFixture {
  providerId: string;
  provider: ProviderId;
  utcKickoff: string; // ISO-8601 UTC timestamp
  phase: NormalizedMatchPhase;
  bucket: MatchBucket;
  statusLong: string;
  elapsed: number | null;
  extraTime: number | null;
  venueName: string | null;
  venueCity: string | null;
  referee: string | null;
  league: {
    providerId: string;
    name: string;
    country: string;
    logo: string | null;
    season: number;
    round: string | null;
  };
  homeTeam: {
    providerId: string;
    name: string;
    logo: string | null;
    winner: boolean | null;
  };
  awayTeam: {
    providerId: string;
    name: string;
    logo: string | null;
    winner: boolean | null;
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: NormalizedScoreBreakdown;
}

export type NormalizedEventCategory =
  | 'goal'
  | 'own_goal'
  | 'penalty'
  | 'missed_penalty'
  | 'yellow_card'
  | 'red_card'
  | 'substitution'
  | 'var'
  | 'other';

export interface NormalizedMatchEvent {
  eventKey: string; // Deterministic dedup key
  minute: number;
  extraMinute: number | null;
  teamId: string;
  teamName: string;
  teamLogo: string | null;
  category: NormalizedEventCategory;
  rawType: string;
  rawDetail: string;
  playerId: string | null;
  playerName: string | null;
  assistPlayerId: string | null;
  assistPlayerName: string | null;
  comments: string | null;
}

export interface NormalizedTeamMatchStats {
  teamId: string;
  teamName: string;
  teamLogo: string | null;
  possession: number | null;
  totalShots: number | null;
  shotsOnTarget: number | null;
  shotsOffTarget: number | null;
  blockedShots: number | null;
  corners: number | null;
  fouls: number | null;
  offsides: number | null;
  yellowCards: number | null;
  redCards: number | null;
  saves: number | null;
  totalPasses: number | null;
  passesAccurate: number | null;
  passAccuracy: number | null;
  expectedGoals: number | null;
}

export interface NormalizedLineupPlayer {
  playerId: string | null;
  name: string;
  number: number | null;
  position: string | null;
  grid: string | null;
  isStarter: boolean;
}

export interface NormalizedTeamLineup {
  teamId: string;
  teamName: string;
  teamLogo: string | null;
  formation: string | null;
  coach: {
    providerId: string | null;
    name: string | null;
    photo: string | null;
  };
  startXI: NormalizedLineupPlayer[];
  substitutes: NormalizedLineupPlayer[];
}

export interface NormalizedLeague {
  providerId: string;
  provider: ProviderId;
  name: string;
  type: string;
  country: string;
  logo: string | null;
  seasons: number[];
  currentSeason: number | null;
}

export interface NormalizedStandingRecord {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface NormalizedStandingRow {
  rank: number;
  teamId: string;
  teamName: string;
  teamLogo: string | null;
  points: number;
  goalsDiff: number;
  form: string | null;
  description: string | null;
  all: NormalizedStandingRecord;
  home: NormalizedStandingRecord;
  away: NormalizedStandingRecord;
}

export interface NormalizedTeamProfile {
  providerId: string;
  provider: ProviderId;
  name: string;
  code: string | null;
  country: string | null;
  founded: number | null;
  logo: string | null;
  venue: {
    name: string | null;
    city: string | null;
    capacity: number | null;
  };
}

export interface NormalizedSquadPlayer {
  playerId: string;
  name: string;
  age: number | null;
  number: number | null;
  position: string | null;
  photo: string | null;
}

export interface NormalizedPlayerStats {
  playerId: string;
  provider: ProviderId;
  name: string;
  age: number | null;
  nationality: string | null;
  photo: string | null;
  injured: boolean | null;
  teamId: string | null;
  teamName: string | null;
  teamLogo: string | null;
  leagueName: string | null;
  position: string | null;
  appearances: number | null;
  minutes: number | null;
  rating: number | null;
  goals: number | null;
  assists: number | null;
  yellowCards: number | null;
  redCards: number | null;
  shotsTotal: number | null;
  shotsOn: number | null;
  keyPasses: number | null;
  passAccuracy: number | null;
}

export interface NormalizedCoach {
  providerId: string;
  name: string;
  nationality: string | null;
  age: number | null;
  photo: string | null;
  teamId: string | null;
  teamName: string | null;
  teamLogo: string | null;
}

export interface NormalizedTransfer {
  playerId: string | null;
  playerName: string;
  date: string | null;
  type: string | null;
  fromTeam: string | null;
  fromTeamLogo: string | null;
  toTeam: string | null;
  toTeamLogo: string | null;
}

export interface NormalizedInjury {
  playerId: string | null;
  playerName: string;
  teamId: string | null;
  teamName: string | null;
  teamLogo: string | null;
  type: string | null;
  reason: string | null;
  fixtureId: string | null;
  utcDate: string | null;
}

export interface NormalizedPrediction {
  fixtureId: string;
  winnerTeamId: string | null;
  winnerName: string | null;
  advice: string | null;
  percent: {
    home: string | null;
    draw: string | null;
    away: string | null;
  };
}

export interface ProviderConnectionTestResult {
  provider: ProviderId;
  connected: boolean;
  verifiedAt: string;
  accountName: string | null;
  plan: string | null;
  requestsToday: number | null;
  dailyLimit: number | null;
  remainingToday: number | null;
  error: string | null;
}

export interface LiveDeltaEvent {
  type:
    | 'snapshot'
    | 'goal'
    | 'score_corrected'
    | 'card'
    | 'substitution'
    | 'var'
    | 'status_change'
    | 'heartbeat';
  timestampUtc: string;
  fixtureId?: string;
  summary?: string;
  fixture?: NormalizedFixture;
  event?: NormalizedMatchEvent;
  liveFixtures?: NormalizedFixture[];
}

export interface ApiProviderEnvelope<T> {
  provider: ProviderId;
  dataSource: 'live' | 'unavailable';
  cached: boolean;
  fetchedAtUtc: string;
  unavailableReason?: string;
  data: T;
}
