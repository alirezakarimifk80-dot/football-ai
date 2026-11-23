import type {
  ApiEnvelope,
  League,
  Match,
  NewsArticle,
  Player,
  StandingRow,
  SystemCapabilities,
  Team,
} from '../types/football';
import { apiFetch } from './apiClient';

export interface BootstrapPayload {
  leagues: League[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  news: NewsArticle[];
  standingsByLeague?: Record<string, StandingRow[]>;
}

export interface PastMatchesPayload {
  matches: Match[];
  teams: Team[];
}

export const footballService = {
  getBootstrap(forceRefresh = false): Promise<ApiEnvelope<BootstrapPayload>> {
    return apiFetch<ApiEnvelope<BootstrapPayload>>(
      forceRefresh ? '/api/football/bootstrap?refresh=1' : '/api/football/bootstrap'
    );
  },

  getMatches(forceRefresh = false): Promise<ApiEnvelope<Match[]>> {
    return apiFetch<ApiEnvelope<Match[]>>(
      forceRefresh ? '/api/football/matches?refresh=1' : '/api/football/matches'
    );
  },

  getPastMatches(leagueId = 'all', forceRefresh = false): Promise<ApiEnvelope<PastMatchesPayload>> {
    const params = new URLSearchParams();
    if (leagueId && leagueId !== 'all') params.set('league', leagueId);
    if (forceRefresh) params.set('refresh', '1');
    const qs = params.toString();
    return apiFetch<ApiEnvelope<PastMatchesPayload>>(
      qs ? `/api/football/past-matches?${qs}` : '/api/football/past-matches'
    );
  },

  getMatchById(matchId: string): Promise<ApiEnvelope<Match>> {
    return apiFetch<ApiEnvelope<Match>>(
      `/api/football/matches/${encodeURIComponent(matchId)}`
    );
  },

  refreshLiveMatches(): Promise<ApiEnvelope<Match[]>> {
    return apiFetch<ApiEnvelope<Match[]>>('/api/admin/matches/refresh', {
      method: 'POST',
    });
  },

  getCapabilities(): Promise<SystemCapabilities> {
    return apiFetch<SystemCapabilities>('/api/system/capabilities');
  },

  publishEditorialNews(payload: {
    category: NewsArticle['category'];
    titleEn: string;
    titleFa: string;
    summaryEn: string;
    summaryFa: string;
  }): Promise<ApiEnvelope<NewsArticle>> {
    return apiFetch<ApiEnvelope<NewsArticle>>('/api/admin/news', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
