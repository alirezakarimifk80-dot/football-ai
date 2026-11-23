export type Language = 'en' | 'fa';

export interface LocalizedText {
  en: string;
  fa: string;
}

export type AppScreen =
  | 'home'
  | 'live'
  | 'past-matches'
  | 'match-center'
  | 'leagues'
  | 'teams'
  | 'players'
  | 'ai-lab'
  | 'news'
  | 'favorites'
  | 'profile'
  | 'admin';

export type MatchStatus = 'LIVE' | 'HT' | 'FT' | 'UPCOMING';

export type DataSourceMode = 'mock' | 'live';

export interface ApiEnvelope<T> {
  dataSource: DataSourceMode;
  disclaimer: LocalizedText;
  lastSyncedAt: string;
  data: T;
}

export interface League {
  id: string;
  code: string;
  name: LocalizedText;
  country: LocalizedText;
  season: string;
  accentColor: string;
  tier: number;
  logo?: string | null;
}

export interface Team {
  id: string;
  leagueId: string;
  name: LocalizedText;
  shortName: string;
  logo?: string | null;
  crestPrimary: string;
  crestSecondary: string;
  crestPattern: 'stripes' | 'halves' | 'sash' | 'solid' | 'hoops';
  stadium: LocalizedText;
  manager: LocalizedText;
  formation: string;
  form: ('W' | 'D' | 'L')[];
  seasonStats: {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
    avgPossession: number;
    avgXgFor: number;
    avgXgAgainst: number;
    cleanSheets: number;
  };
}

export interface StandingRow {
  rank: number;
  teamId: string;
  group?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  goalsPerMatch: number;
  form: ('W' | 'D' | 'L')[];
}

export interface PlayerRadar {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

export interface Player {
  id: string;
  teamId: string;
  name: LocalizedText;
  photoUrl?: string | null;
  nationality: LocalizedText;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  age: number;
  shirtNumber: number;
  preferredFoot: 'Right' | 'Left' | 'Both';
  marketValueEurM: number;
  rating: number;
  stats: {
    appearances: number;
    goals: number;
    assists: number;
    xG: number;
    xA: number;
    passAccuracy: number;
    keyPassesPer90: number;
    shotsPer90: number;
    tacklesPer90: number;
  };
  radar: PlayerRadar;
  recentRatings: { matchLabel: string; rating: number }[];
}

export interface MatchEvent {
  id: string;
  minute: number;
  addedTime?: number;
  teamSide: 'home' | 'away';
  type: 'goal' | 'yellow' | 'red' | 'sub' | 'var';
  playerName: LocalizedText;
  assistOrDetail?: LocalizedText;
}

export interface LineupPlayer {
  number: number;
  name: LocalizedText;
  photoUrl?: string | null;
  position: string;
  rating: number;
  x: number; // 0-100 pitch width percentage
  y: number; // 0-100 half-pitch depth percentage
  goals?: number;
  assists?: number;
  yellowCard?: boolean;
  redCard?: boolean;
  subMinute?: number;
  isManOfTheMatch?: boolean;
}

export interface ExtraMatchStat {
  label: LocalizedText;
  home: number;
  away: number;
  suffix?: string;
}

export interface PlayerOfTheMatch {
  name: LocalizedText;
  photoUrl?: string | null;
  rating: number;
  teamSide?: 'home' | 'away';
}

export interface MatchStats {
  possession: [number, number];
  xG: [number, number];
  totalShots: [number, number];
  shotsOnTarget: [number, number];
  bigChances: [number, number];
  passAccuracy: [number, number];
  corners: [number, number];
  tackles: [number, number];
  fouls: [number, number];
}

export interface MomentumPoint {
  minute: number;
  homePressure: number; // positive 0..100
  awayPressure: number; // negative -100..0 for diverging chart
  homeXg: number;
  awayXg: number;
}

export interface Match {
  id: string;
  leagueId: string;
  dayOffset: number; // -1 yesterday, 0 today, 1 tomorrow
  matchDate?: string; // ISO YYYY-MM-DD
  kickoffTime: string;
  status: MatchStatus;
  minute?: number;
  venue: LocalizedText;
  referee: LocalizedText;
  attendance?: number;
  round: LocalizedText;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  isFeatured?: boolean;
  hasXg?: boolean;
  hasDetailedStats?: boolean;
  playerOfTheMatch?: PlayerOfTheMatch;
  winProbability: {
    home: number;
    draw: number;
    away: number;
  };
  stats: MatchStats;
  extraStats?: ExtraMatchStat[];
  events: MatchEvent[];
  momentum: MomentumPoint[];
  lineups: {
    homeFormation: string;
    awayFormation: string;
    homeXI: LineupPlayer[];
    awayXI: LineupPlayer[];
    homeSubs?: LineupPlayer[];
    awaySubs?: LineupPlayer[];
  };
  h2h: {
    homeWins: number;
    draws: number;
    awayWins: number;
    recentMeetings: {
      date: string;
      homeShort: string;
      awayShort: string;
      score: string;
      competition: string;
    }[];
  };
}

export interface NewsArticle {
  id: string;
  category: 'tactics' | 'transfers' | 'match-report' | 'analytics';
  title: LocalizedText;
  summary: LocalizedText;
  body: LocalizedText;
  author: LocalizedText;
  publishedAt: string;
  readTimeMin: number;
  imageUrl: string;
  sourceUrl?: string;
  relatedLeagueId?: string;
}

export interface AIMatchAnalysisResponse {
  headline: string;
  tacticalSummary: string;
  keyBattle: string;
  momentumInsight: string;
  predictedEdge: string;
  tacticalBullets: string[];
  modelUsed: string;
  generatedAt: string;
}

export interface AIPlayerCompareResponse {
  headline: string;
  verdict: string;
  playerAStrengths: string[];
  playerBStrengths: string[];
  tacticalFitSummary: string;
  modelUsed: string;
  generatedAt: string;
}

export interface AIAskResponse {
  answer: string;
  keyTakeaways: string[];
  modelUsed: string;
  generatedAt: string;
}

export interface AIWinProbabilityPoint {
  minute: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  eventLabel?: string;
}

export interface AIWinProbabilityResponse {
  current: {
    homeWin: number;
    draw: number;
    awayWin: number;
  };
  timeline: AIWinProbabilityPoint[];
  keyDrivers: string[];
  turningPointSummary: string;
  historicalEdgeNote: string;
  modelUsed: string;
  generatedAt: string;
}

export interface UserPreferences {
  displayName: string;
  roleTitle: string;
  favoriteTeamIds: string[];
  favoriteMatchIds: string[];
  favoriteLeagueIds: string[];
  favoritePlayerIds: string[];
  showXgOnCards: boolean;
  compactMatchRows: boolean;
  liveGoalAlerts: boolean;
  aiInsightAlerts: boolean;
  defaultScreen: 'home' | 'live' | 'ai-lab';
}

export interface SystemCapabilities {
  dataSource: DataSourceMode;
  geminiConfigured: boolean;
  externalFootballApiConfigured: boolean;
  capacitorReady: boolean;
  serverTime: string;
  aiRequestsCount: number;
  demoFixturesCount: number;
  newsCount: number;
}
