import {
  DEMO_DISCLAIMER,
  INITIAL_LEAGUES,
  INITIAL_MATCHES,
  INITIAL_NEWS,
  INITIAL_PLAYERS,
  INITIAL_TEAMS,
} from '../src/data/mockDataset.ts';
import type {
  ApiEnvelope,
  DataSourceMode,
  League,
  Match,
  MatchStatus,
  NewsArticle,
  Player,
  Team,
} from '../src/types/football.ts';

// In-memory mutable demo store so Admin Dashboard updates propagate cleanly
const leaguesStore: League[] = structuredClone(INITIAL_LEAGUES);
const teamsStore: Team[] = structuredClone(INITIAL_TEAMS);
const playersStore: Player[] = structuredClone(INITIAL_PLAYERS);
const matchesStore: Match[] = structuredClone(INITIAL_MATCHES);
const newsStore: NewsArticle[] = structuredClone(INITIAL_NEWS);

export function isExternalFootballApiConfigured(): boolean {
  const key = process.env.FOOTBALL_API_KEY?.trim();
  return Boolean(key && key.length > 5);
}

export function getActiveDataSource(): DataSourceMode {
  return isExternalFootballApiConfigured() ? 'live' : 'mock';
}

export function wrapEnvelope<T>(data: T): ApiEnvelope<T> {
  const mode = getActiveDataSource();
  return {
    dataSource: mode,
    disclaimer:
      mode === 'mock'
        ? DEMO_DISCLAIMER
        : {
            en: 'Connected to external Football Data API provider.',
            fa: 'متصل به سرویس خارجی داده‌های زنده فوتبال.',
          },
    lastSyncedAt: new Date().toISOString(),
    data,
  };
}

export function getBootstrapData() {
  return {
    leagues: leaguesStore,
    teams: teamsStore,
    players: playersStore,
    matches: matchesStore,
    news: newsStore,
  };
}

export function getMatches(): Match[] {
  return matchesStore;
}

export function getMatchById(id: string): Match | undefined {
  return matchesStore.find((m) => m.id === id);
}

export function getTeamById(id: string): Team | undefined {
  return teamsStore.find((t) => t.id === id);
}

export function getLeagueById(id: string): League | undefined {
  return leaguesStore.find((l) => l.id === id);
}

export function getPlayerById(id: string): Player | undefined {
  return playersStore.find((p) => p.id === id);
}

export function getNewsCount(): number {
  return newsStore.length;
}

export function updateDemoMatch(
  id: string,
  patch: {
    homeScore?: number | null;
    awayScore?: number | null;
    minute?: number;
    status?: MatchStatus;
  }
): Match | null {
  const target = matchesStore.find((m) => m.id === id);
  if (!target) return null;

  if (patch.status !== undefined) {
    target.status = patch.status;
  }
  if (patch.homeScore !== undefined) {
    target.homeScore = patch.homeScore;
  }
  if (patch.awayScore !== undefined) {
    target.awayScore = patch.awayScore;
  }
  if (patch.minute !== undefined) {
    target.minute = patch.minute;
  }
  return target;
}

export function advanceLiveDemoClocks(): Match[] {
  for (const match of matchesStore) {
    if (match.status === 'LIVE') {
      const nextMinute = (match.minute ?? 1) + 1;
      if (nextMinute >= 90) {
        match.minute = 90;
        match.status = 'FT';
      } else {
        match.minute = nextMinute;
      }
    }
  }
  return matchesStore;
}

export function createDemoNewsArticle(input: {
  category: NewsArticle['category'];
  titleEn: string;
  titleFa: string;
  summaryEn: string;
  summaryFa: string;
}): NewsArticle {
  const article: NewsArticle = {
    id: `n-custom-${Date.now()}`,
    category: input.category,
    title: { en: input.titleEn, fa: input.titleFa },
    summary: { en: input.summaryEn, fa: input.summaryFa },
    body: {
      en: `${input.summaryEn} Published via the Football AI Admin Desk using clearly labeled Demo Dataset telemetry.`,
      fa: `${input.summaryFa} منتشرشده از طریق پنل مدیریت Football AI بر پایه داده‌های آزمایشی پلتفرم.`,
    },
    author: { en: 'Football AI Editorial Desk', fa: 'تحریریه Football AI' },
    publishedAt: 'Just now',
    readTimeMin: 3,
    imageUrl: '/src/assets/images/news_scouting_analytics_1795373660766.jpg',
  };
  newsStore.unshift(article);
  return article;
}

export function buildContextSummaryForAI(): string {
  const lines = matchesStore.map((m) => {
    const home = getTeamById(m.homeTeamId)?.name.en ?? m.homeTeamId;
    const away = getTeamById(m.awayTeamId)?.name.en ?? m.awayTeamId;
    const score = m.homeScore !== null && m.awayScore !== null ? `${m.homeScore}-${m.awayScore}` : 'vs';
    return `- ${home} ${score} ${away} [${m.status}${m.minute ? ` ${m.minute}'` : ''}] xG ${m.stats.xG[0]}-${m.stats.xG[1]}`;
  });
  return `Active Demo Matches:\n${lines.join('\n')}`;
}
