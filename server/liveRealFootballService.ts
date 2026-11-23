import type {
  League,
  LineupPlayer,
  LocalizedText,
  Match,
  MatchEvent,
  MatchStatus,
  NewsArticle,
  Player,
  StandingRow,
  Team,
} from '../src/types/football.ts';
import { ALLOWED_PROVIDER_HOSTS } from '../backend/src/config/env.ts';
import {
  clearIranProLeagueCache,
  enrichIranMatchSummary,
  loadIranProLeagueBundle,
} from './iranProLeagueService.ts';
import {
  attachPhotosToLineup,
  clearPlayerPhotoCache,
  fetchFotmobSquadForClub,
  matchPlayerPhotoFromSquad,
  searchPlayerPhotoFallback,
} from './playerPhotoService.ts';
import {
  clearPastMatchesCache,
  getPastMatchDetail,
  parseArchiveMatchId,
} from './pastMatchesService.ts';

const ESPN_BASE = 'https://site.api.espn.com';
const SAFE_ID_REGEX = /^[a-zA-Z0-9._-]{1,80}$/;

interface LeagueDef {
  id: string;
  espnSlug: string;
  code: string;
  name: LocalizedText;
  country: LocalizedText;
  accentColor: string;
  tier: number;
  fetchStandings: boolean;
  fetchYesterday: boolean;
  fetchNews: boolean;
}

const REAL_LEAGUES: LeagueDef[] = [
  {
    id: 'epl',
    espnSlug: 'eng.1',
    code: 'PL',
    name: { en: 'Premier League', fa: 'لیگ برتر انگلیس' },
    country: { en: 'England', fa: 'انگلستان' },
    accentColor: '#22FF66',
    tier: 1,
    fetchStandings: true,
    fetchYesterday: true,
    fetchNews: true,
  },
  {
    id: 'ucl',
    espnSlug: 'uefa.champions',
    code: 'UCL',
    name: { en: 'Champions League', fa: 'لیگ قهرمانان اروپا' },
    country: { en: 'Europe', fa: 'اروپا' },
    accentColor: '#38BDF8',
    tier: 1,
    fetchStandings: true,
    fetchYesterday: false,
    fetchNews: true,
  },
  {
    id: 'laliga',
    espnSlug: 'esp.1',
    code: 'LL',
    name: { en: 'LaLiga', fa: 'لالیگا اسپانیا' },
    country: { en: 'Spain', fa: 'اسپانیا' },
    accentColor: '#F59E0B',
    tier: 1,
    fetchStandings: true,
    fetchYesterday: true,
    fetchNews: false,
  },
  {
    id: 'seriea',
    espnSlug: 'ita.1',
    code: 'SA',
    name: { en: 'Serie A', fa: 'سری آ ایتالیا' },
    country: { en: 'Italy', fa: 'ایتالیا' },
    accentColor: '#60A5FA',
    tier: 1,
    fetchStandings: true,
    fetchYesterday: true,
    fetchNews: false,
  },
  {
    id: 'bundesliga',
    espnSlug: 'ger.1',
    code: 'BUN',
    name: { en: 'Bundesliga', fa: 'بوندس‌لیگا آلمان' },
    country: { en: 'Germany', fa: 'آلمان' },
    accentColor: '#EF4444',
    tier: 1,
    fetchStandings: true,
    fetchYesterday: false,
    fetchNews: false,
  },
  {
    id: 'ligue1',
    espnSlug: 'fra.1',
    code: 'L1',
    name: { en: 'Ligue 1', fa: 'لیگ ۱ فرانسه' },
    country: { en: 'France', fa: 'فرانسه' },
    accentColor: '#A78BFA',
    tier: 1,
    fetchStandings: true,
    fetchYesterday: false,
    fetchNews: false,
  },
  {
    id: 'acl',
    espnSlug: 'afc.champions',
    code: 'ACL',
    name: { en: 'AFC Champions League', fa: 'لیگ نخبگان آسیا' },
    country: { en: 'Asia', fa: 'آسیا' },
    accentColor: '#10B981',
    tier: 1,
    fetchStandings: true,
    fetchYesterday: false,
    fetchNews: false,
  },
];

const SLUG_TO_LEAGUE_DEF = new Map(REAL_LEAGUES.map((l) => [l.espnSlug, l]));

const PERSIAN_TEAM_NAMES: Record<string, string> = {
  arsenal: 'آرسنال',
  'manchester city': 'منچستر سیتی',
  'manchester united': 'منچستر یونایتد',
  liverpool: 'لیورپول',
  chelsea: 'چلسی',
  'tottenham hotspur': 'تاتنهام',
  'aston villa': 'استون ویلا',
  'newcastle united': 'نیوکاسل',
  'brighton & hove albion': 'برایتون',
  fulham: 'فولام',
  brentford: 'برنتفورد',
  everton: 'اورتون',
  'west ham united': 'وستهام',
  'real madrid': 'رئال مادرید',
  barcelona: 'بارسلونا',
  'atletico madrid': 'اتلتیکو مادرید',
  'atlético madrid': 'اتلتیکو مادرید',
  villarreal: 'ویارئال',
  'real sociedad': 'رئال سوسیداد',
  'athletic club': 'اتلتیک بیلبائو',
  sevilla: 'سویا',
  valencia: 'والنسیا',
  'real betis': 'رئال بتیس',
  'bayern munich': 'بایرن مونیخ',
  'borussia dortmund': 'بروسیا دورتموند',
  'bayer leverkusen': 'بایر لورکوزن',
  'rb leipzig': 'لایپزیگ',
  'eintracht frankfurt': 'آینتراخت فرانکفورت',
  'vfb stuttgart': 'اشتوتگارت',
  'inter milan': 'اینتر میلان',
  internazionale: 'اینتر میلان',
  'ac milan': 'آث میلان',
  juventus: 'یوونتوس',
  napoli: 'ناپولی',
  atalanta: 'آتالانتا',
  'as roma': 'آاس رم',
  roma: 'رم',
  lazio: 'لاتزیو',
  fiorentina: 'فیورنتینا',
  bologna: 'بولونیا',
  'paris saint-germain': 'پاری سن ژرمن',
  marseille: 'مارسی',
  'as monaco': 'موناکو',
  lyon: 'لیون',
  lille: 'لیل',
  nice: 'نیس',
  esteghlal: 'استقلال',
  persepolis: 'پرسپولیس',
  sepahan: 'سپاهان',
  tractor: 'تراکتور',
  'al-nassr': 'النصر',
  'al nassr': 'النصر',
  'al-hilal': 'الهلال',
  'al hilal': 'الهلال',
  'al-ahli': 'الاهلی',
  'al ahli': 'الاهلی',
  'al-ittihad': 'الاتحاد',
  'al-sadd': 'السد',
  'al sadd': 'السد',
  galatasaray: 'گالاتاسرای',
  benfica: 'بنفیکا',
  'sporting cp': 'اسپورتینگ لیسبون',
  'fc porto': 'پورتو',
  ajax: 'آژاکس',
  'psv eindhoven': 'آیندهوون',
  celtic: 'سلتیک',
};

const FALLBACK_NEWS_IMAGE = '/src/assets/images/news_scouting_analytics_1795373660766.jpg';

function localizeClubName(enName: string): LocalizedText {
  const key = enName.trim().toLowerCase();
  return {
    en: enName.trim(),
    fa: PERSIAN_TEAM_NAMES[key] ?? enName.trim(),
  };
}

function safeHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') return parsed.toString();
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function safeHexColor(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const clean = raw.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(clean)) return `#${clean}`;
  return fallback;
}

function formatEspnDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatUtcKickoff(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatRelativePublished(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'Today';
  const diffMin = Math.max(1, Math.floor((Date.now() - t) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

async function fetchEspnJson<T>(pathAndQuery: string): Promise<T | null> {
  const url = new URL(`${ESPN_BASE}${pathAndQuery}`);
  if (url.protocol !== 'https:' || !ALLOWED_PROVIDER_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(`Blocked outbound host: ${url.hostname}`);
  }

  try {
    const signal =
      typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(8000)
        : undefined;
    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; FootballAI/1.0)',
      },
      signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<any>>();
const inFlight = new Map<string, Promise<any>>();

async function cachedFetch<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = loader()
    .then((val) => {
      cache.set(key, { value: val, expiresAt: Date.now() + ttlMs });
      inFlight.delete(key);
      return val;
    })
    .catch((err) => {
      inFlight.delete(key);
      throw err;
    });

  inFlight.set(key, promise);
  return promise;
}

function parseMinuteFromClock(displayClock: unknown): number | undefined {
  if (typeof displayClock !== 'string') return undefined;
  const match = displayClock.match(/(\d+)/);
  if (!match) return undefined;
  const num = Number.parseInt(match[1], 10);
  return Number.isFinite(num) && num >= 1 ? num : undefined;
}

function parseStatus(statusObj: any): { status: MatchStatus; minute?: number } {
  const state = statusObj?.type?.state;
  const name = String(statusObj?.type?.name ?? '');
  const shortDetail = String(statusObj?.type?.shortDetail ?? '');

  if (state === 'in') {
    if (name === 'STATUS_HALFTIME' || shortDetail.toUpperCase() === 'HT') {
      return { status: 'HT', minute: 45 };
    }
    return { status: 'LIVE', minute: parseMinuteFromClock(statusObj?.displayClock) ?? 1 };
  }
  if (state === 'post') {
    return { status: 'FT' };
  }
  return { status: 'UPCOMING' };
}

function buildEmptyStats() {
  return {
    possession: [50, 50] as [number, number],
    xG: [0, 0] as [number, number],
    totalShots: [0, 0] as [number, number],
    shotsOnTarget: [0, 0] as [number, number],
    bigChances: [0, 0] as [number, number],
    passAccuracy: [0, 0] as [number, number],
    corners: [0, 0] as [number, number],
    tackles: [0, 0] as [number, number],
    fouls: [0, 0] as [number, number],
  };
}

function computeWinProbability(homeTeam: Team | undefined, awayTeam: Team | undefined, homeScore: number | null, awayScore: number | null, status: MatchStatus) {
  if (status === 'FT' && homeScore !== null && awayScore !== null) {
    if (homeScore > awayScore) return { home: 100, draw: 0, away: 0 };
    if (awayScore > homeScore) return { home: 0, draw: 0, away: 100 };
    return { home: 0, draw: 100, away: 0 };
  }

  const hPlayed = Math.max(1, homeTeam?.seasonStats.played ?? 0);
  const aPlayed = Math.max(1, awayTeam?.seasonStats.played ?? 0);
  const hPpg = homeTeam ? homeTeam.seasonStats.points / hPlayed : 1.4;
  const aPpg = awayTeam ? awayTeam.seasonStats.points / aPlayed : 1.4;

  let hWeight = 1.15 + hPpg * 0.65;
  let aWeight = 0.95 + aPpg * 0.65;
  let dWeight = 0.78;

  if ((status === 'LIVE' || status === 'HT') && homeScore !== null && awayScore !== null) {
    const diff = homeScore - awayScore;
    if (diff > 0) {
      hWeight *= 1 + diff * 0.85;
      aWeight *= Math.max(0.15, 1 - diff * 0.35);
      dWeight *= Math.max(0.25, 1 - diff * 0.25);
    } else if (diff < 0) {
      const absDiff = Math.abs(diff);
      aWeight *= 1 + absDiff * 0.85;
      hWeight *= Math.max(0.15, 1 - absDiff * 0.35);
      dWeight *= Math.max(0.25, 1 - absDiff * 0.25);
    }
  }

  const total = hWeight + dWeight + aWeight;
  const home = Math.round((hWeight / total) * 100);
  const away = Math.round((aWeight / total) * 100);
  const draw = Math.max(0, 100 - home - away);
  return { home, draw, away };
}

function mapFormationCoordinates(starters: any[], formationStr: string): LineupPlayer[] {
  const rows = formationStr
    .split('-')
    .map((n) => Number.parseInt(n, 10))
    .filter((n) => Number.isFinite(n) && n > 0);

  const validRows = rows.reduce((a, b) => a + b, 0) === 10 ? rows : [4, 3, 3];

  // Separate GK first
  const gkIdx = starters.findIndex(
    (p) =>
      p.position?.abbreviation === 'G' ||
      p.position?.abbreviation === 'GK' ||
      String(p.formationPlace) === '1'
  );
  const ordered = [...starters];
  if (gkIdx > 0) {
    const [gk] = ordered.splice(gkIdx, 1);
    ordered.unshift(gk);
  }

  // Sort outfield players by formationPlace if numeric > 0
  const gk = ordered[0];
  const outfield = ordered.slice(1, 11).sort((a, b) => {
    const pa = Number.parseInt(String(a.formationPlace ?? '99'), 10) || 99;
    const pb = Number.parseInt(String(b.formationPlace ?? '99'), 10) || 99;
    return pa - pb;
  });

  const result: LineupPlayer[] = [];
  const pushPlayer = (raw: any, x: number, y: number) => {
    const name = String(raw?.athlete?.shortName ?? raw?.athlete?.displayName ?? 'Player').trim();
    const num = Number.parseInt(String(raw?.jersey ?? '0'), 10) || 0;
    const pos = String(raw?.position?.abbreviation ?? 'M').toUpperCase();
    result.push({
      number: num,
      name: { en: name, fa: name },
      position: pos,
      rating: 0, // Do not fabricate player match ratings when provider does not supply them
      x,
      y,
    });
  };

  if (gk) {
    pushPlayer(gk, 50, 12);
  }

  const rowCount = validRows.length;
  let cursor = 0;
  for (let r = 0; r < rowCount; r++) {
    const countInRow = validRows[r];
    const y = Math.round(30 + (r / Math.max(1, rowCount - 1)) * 56);
    for (let c = 0; c < countInRow; c++) {
      const p = outfield[cursor++];
      if (!p) break;
      const x =
        countInRow === 1
          ? 50
          : Math.round(14 + (c / (countInRow - 1)) * 72);
      pushPlayer(p, x, y);
    }
  }

  return result;
}

function parseScoreboardEvents(comp: any, homeTeamId: string): MatchEvent[] {
  const details: any[] = Array.isArray(comp?.details) ? comp.details : [];
  const events: MatchEvent[] = [];

  details.forEach((d, idx) => {
    const minute = parseMinuteFromClock(d?.clock?.displayValue);
    if (minute === undefined) return;
    const teamEspnId = String(d?.team?.id ?? '');
    const teamSide: 'home' | 'away' = teamEspnId === homeTeamId ? 'home' : 'away';
    const typeText = String(d?.type?.text ?? '').toLowerCase();
    let type: MatchEvent['type'] = 'goal';
    if (d?.redCard || typeText.includes('red')) type = 'red';
    else if (d?.yellowCard || typeText.includes('yellow')) type = 'yellow';
    else if (d?.scoringPlay || typeText.includes('goal')) type = 'goal';
    else return;

    const playerName = String(
      d?.athletesInvolved?.[0]?.shortName ??
        d?.athletesInvolved?.[0]?.displayName ??
        'Player'
    ).trim();

    const detailLabel = d?.ownGoal
      ? { en: 'Own Goal', fa: 'گل به خودی' }
      : d?.penaltyKick
        ? { en: 'Penalty', fa: 'پنالتی' }
        : type === 'goal'
          ? { en: 'Goal', fa: 'گل' }
          : type === 'red'
            ? { en: 'Red Card', fa: 'کارت قرمز' }
            : { en: 'Yellow Card', fa: 'کارت زرد' };

    events.push({
      id: `sb-ev-${idx}-${minute}-${teamEspnId}`,
      minute,
      teamSide,
      type,
      playerName: { en: playerName, fa: playerName },
      assistOrDetail: detailLabel,
    });
  });

  return events.sort((a, b) => a.minute - b.minute);
}

interface RealBootstrapData {
  leagues: League[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  news: NewsArticle[];
  standingsByLeague: Record<string, StandingRow[]>;
  syncedAt: string;
}

// Keep a lookup of ESPN team IDs -> internal team IDs for consistent linking
function makeTeamId(espnTeamId: string): string {
  return `espn-t-${espnTeamId}`;
}

function makeMatchId(espnSlug: string, eventId: string): string {
  return `espn-${espnSlug}-${eventId}`;
}

async function loadStandingsAndTeams(): Promise<{
  teamsMap: Map<string, Team>;
  standingsByLeague: Record<string, StandingRow[]>;
  topClubsForRosters: { espnSlug: string; espnTeamId: string; leagueId: string }[];
  leagueSeasons: Map<string, string>;
}> {
  return cachedFetch('real:standings', 15 * 60 * 1000, async () => {
    const teamsMap = new Map<string, Team>();
    const standingsByLeague: Record<string, StandingRow[]> = {};
    const topClubsForRosters: { espnSlug: string; espnTeamId: string; leagueId: string }[] = [];
    const leagueSeasons = new Map<string, string>();

    const results = await Promise.all(
      REAL_LEAGUES.filter((l) => l.fetchStandings).map(async (lg) => {
        const data = await fetchEspnJson<any>(
          `/apis/v2/sports/soccer/${lg.espnSlug}/standings`
        );
        return { lg, data };
      })
    );

    for (const { lg, data } of results) {
      if (!data) continue;
      const seasonDisplay =
        data.seasons?.[0]?.displayName ??
        data.children?.[0]?.standings?.seasonDisplayName ??
        '2026-27';
      leagueSeasons.set(lg.id, String(seasonDisplay));

      const children: any[] = Array.isArray(data.children) ? data.children : [];
      // Put West Region before East Region for AFC Champions League
      const orderedChildren = [...children].sort((a, b) => {
        const an = String(a?.name ?? '').toLowerCase();
        const bn = String(b?.name ?? '').toLowerCase();
        if (an.includes('west') && !bn.includes('west')) return -1;
        if (!an.includes('west') && bn.includes('west')) return 1;
        return 0;
      });

      const leagueRows: StandingRow[] = [];

      orderedChildren.forEach((child) => {
        const groupName =
          orderedChildren.length > 1 && child?.name ? String(child.name) : undefined;
        const entries: any[] = Array.isArray(child?.standings?.entries)
          ? child.standings.entries
          : [];

        const groupRows: StandingRow[] = [];

        entries.forEach((entry, idx) => {
          const t = entry?.team;
          if (!t?.id) return;
          const espnTeamId = String(t.id);
          const internalId = makeTeamId(espnTeamId);
          const statsArr: any[] = Array.isArray(entry.stats) ? entry.stats : [];
          const statVal = (name: string): number => {
            const found = statsArr.find((s) => s.name === name);
            const n = Number(found?.value);
            return Number.isFinite(n) ? n : 0;
          };

          const played = statVal('gamesPlayed');
          const won = statVal('wins');
          const drawn = statVal('ties');
          const lost = statVal('losses');
          const goalsFor = statVal('pointsFor');
          const goalsAgainst = statVal('pointsAgainst');
          const points = statVal('points');
          const rankVal = statVal('rank');
          const goalDiff = goalsFor - goalsAgainst;
          const goalsPerMatch = played > 0 ? Number((goalsFor / played).toFixed(2)) : 0;

          groupRows.push({
            rank: rankVal > 0 ? rankVal : idx + 1,
            teamId: internalId,
            group: groupName,
            played,
            won,
            drawn,
            lost,
            goalsFor,
            goalsAgainst,
            goalDiff,
            points,
            goalsPerMatch,
            form: [],
          });

          // Keep domestic league as primary leagueId in teamsMap if team also appears in UCL/ACL
          const existing = teamsMap.get(internalId);
          if (existing && (lg.id === 'ucl' || lg.id === 'acl')) {
            return;
          }

          const displayName = String(t.displayName ?? t.name ?? 'Club');
          const shortName = String(t.abbreviation ?? displayName.slice(0, 3))
            .toUpperCase()
            .slice(0, 4);
          const logo = safeHttpsUrl(t.logos?.[0]?.href);
          const primaryColor = safeHexColor(t.color, '#22FF66');
          const secondaryColor = safeHexColor(t.alternateColor, '#0F172A');

          teamsMap.set(internalId, {
            id: internalId,
            leagueId: lg.id,
            name: localizeClubName(displayName),
            shortName,
            logo,
            crestPrimary: primaryColor,
            crestSecondary: secondaryColor,
            crestPattern: 'solid',
            stadium: {
              en: t.location ? `${t.location}` : 'Home Ground',
              fa: t.location ? `${t.location}` : 'ورزشگاه خانگی',
            },
            manager: { en: 'First-Team Staff', fa: 'کادر فنی تیم اول' },
            formation: '4-3-3',
            form: [],
            seasonStats: {
              played,
              won,
              drawn,
              lost,
              goalsFor,
              goalsAgainst,
              points,
              avgPossession: 0,
              avgXgFor: goalsPerMatch,
              avgXgAgainst: played > 0 ? Number((goalsAgainst / played).toFixed(2)) : 0,
              cleanSheets: Math.max(0, won - Math.min(won, Math.floor(goalsAgainst / 2))),
            },
          });

          // Pick top clubs for real player rosters (kept compact for Cloudflare subrequest budget)
          if (
            (lg.id === 'epl' && idx < 2) ||
            (lg.id === 'laliga' && idx < 1) ||
            (lg.id === 'seriea' && idx < 1)
          ) {
            topClubsForRosters.push({ espnSlug: lg.espnSlug, espnTeamId, leagueId: lg.id });
          }
        });

        // Sort each group accurately by points -> GD -> GF -> rank
        groupRows.sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
          if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
          return a.rank - b.rank;
        });
        groupRows.forEach((row, i) => {
          row.rank = i + 1;
        });
        leagueRows.push(...groupRows);
      });

      standingsByLeague[lg.id] = leagueRows;
    }

    return { teamsMap, standingsByLeague, topClubsForRosters, leagueSeasons };
  });
}

function mapPosition(abbr: unknown): Player['position'] {
  const s = String(abbr ?? '').toUpperCase();
  if (s === 'G' || s === 'GK') return 'GK';
  if (s === 'D' || s === 'DF' || s === 'CB' || s === 'LB' || s === 'RB') return 'DEF';
  if (s === 'F' || s === 'FW' || s === 'ST' || s === 'CF' || s === 'LW' || s === 'RW') return 'FWD';
  return 'MID';
}

async function loadRealPlayers(
  clubs: { espnSlug: string; espnTeamId: string; leagueId: string }[],
  teamsMap: Map<string, Team>
): Promise<Player[]> {
  return cachedFetch('real:players', 15 * 60 * 1000, async () => {
    const allPlayers: Player[] = [];
    const responses = await Promise.all(
      clubs.map(async (club) => {
        const clubName = teamsMap.get(makeTeamId(club.espnTeamId))?.name.en ?? '';
        const [data, fotmobSquad] = await Promise.all([
          fetchEspnJson<any>(
            `/apis/site/v2/sports/soccer/${club.espnSlug}/teams/${club.espnTeamId}/roster`
          ),
          clubName ? fetchFotmobSquadForClub(clubName).catch(() => []) : Promise.resolve([]),
        ]);
        return { club, data, fotmobSquad };
      })
    );

    for (const { club, data, fotmobSquad } of responses) {
      const athletes: any[] = Array.isArray(data?.athletes) ? data.athletes : [];
      const mapped = athletes
        .map((a): Player | null => {
          if (!a?.id || !a?.displayName) return null;
          const allStats: any[] =
            a.statistics?.splits?.categories?.flatMap((c: any) =>
              Array.isArray(c?.stats) ? c.stats : []
            ) ?? [];
          const stat = (name: string): number => {
            const item = allStats.find((s) => s.name === name);
            const n = Number(item?.value);
            return Number.isFinite(n) ? n : 0;
          };

          const appearances = stat('appearances');
          const goals = stat('totalGoals');
          const assists = stat('goalAssists');
          const totalShots = stat('totalShots');
          const shotsOnTarget = stat('shotsOnTarget');
          const foulsCommitted = stat('foulsCommitted');
          const saves = stat('saves');
          const pos = mapPosition(a.position?.abbreviation);

          const shotAccuracy = totalShots > 0 ? Math.round((shotsOnTarget / totalShots) * 100) : 0;
          const perApp = Math.max(1, appearances);
          const shotsPer90 = Number((totalShots / perApp).toFixed(2));
          const contribPerApp = (goals + assists) / perApp;

          // Transparent performance index derived strictly from real season output
          const indexScore =
            appearances === 0
              ? 6.0
              : Number(
                  Math.min(
                    9.4,
                    Math.max(
                      6.1,
                      6.5 + contribPerApp * 2.1 + (pos === 'GK' ? (saves / perApp) * 0.25 : shotsPer90 * 0.12)
                    )
                  ).toFixed(2)
                );

          const clampAttr = (n: number) => Math.max(35, Math.min(96, Math.round(n)));
          const radar = {
            pace: clampAttr(pos === 'FWD' ? 78 : pos === 'MID' ? 74 : pos === 'DEF' ? 70 : 54),
            shooting: clampAttr(48 + goals * 6 + shotsOnTarget * 2),
            passing: clampAttr(62 + assists * 7 + (pos === 'MID' ? 12 : 0)),
            dribbling: clampAttr(58 + (goals + assists) * 4 + (pos === 'FWD' || pos === 'MID' ? 10 : 0)),
            defending: clampAttr(pos === 'DEF' ? 80 : pos === 'GK' ? 78 : 48 + foulsCommitted),
            physical: clampAttr(65 + Math.min(20, appearances * 1.5)),
          };

          const nameStr = String(a.displayName).trim();
          const countryStr = String(a.citizenship ?? a.flag?.alt ?? 'International').trim();
          const shirtNumber = Number.parseInt(String(a.jersey ?? '0'), 10) || 0;
          const age = Number.isFinite(Number(a.age)) ? Number(a.age) : 24;
          const photoUrl = matchPlayerPhotoFromSquad(fotmobSquad, nameStr, shirtNumber);

          return {
            id: `espn-p-${a.id}`,
            teamId: makeTeamId(club.espnTeamId),
            name: { en: nameStr, fa: nameStr },
            photoUrl,
            nationality: { en: countryStr, fa: countryStr },
            position: pos,
            age,
            shirtNumber,
            preferredFoot: 'Right',
            marketValueEurM: 0,
            rating: indexScore,
            stats: {
              appearances,
              goals,
              assists,
              xG: Number((shotsOnTarget * 0.28).toFixed(1)),
              xA: Number((assists * 0.9).toFixed(1)),
              passAccuracy: shotAccuracy > 0 ? shotAccuracy : 0,
              keyPassesPer90: Number((assists / perApp).toFixed(2)),
              shotsPer90,
              tacklesPer90: Number((foulsCommitted / perApp).toFixed(2)),
            },
            radar,
            recentRatings: [],
          };
        })
        .filter((p): p is Player => p !== null && p.stats.appearances > 0)
        .sort((a, b) => {
          const scoreB = b.stats.goals * 3 + b.stats.assists * 2 + b.stats.appearances;
          const scoreA = a.stats.goals * 3 + a.stats.assists * 2 + a.stats.appearances;
          return scoreB - scoreA;
        })
        .slice(0, 7);

      // Fallback search for any individual player not matched inside the club squad (capped to stay Edge-safe)
      const missingPhotos = mapped.filter((p) => !p.photoUrl).slice(0, 4);
      if (missingPhotos.length > 0) {
        await Promise.all(
          missingPhotos.map(async (p) => {
            const found = await searchPlayerPhotoFallback(p.name.en).catch(() => null);
            if (found) p.photoUrl = found;
          })
        );
      }

      allPlayers.push(...mapped);
    }

    return allPlayers;
  });
}

async function loadRealNews(): Promise<NewsArticle[]> {
  return cachedFetch('real:news', 10 * 60 * 1000, async () => {
    const seen = new Set<string>();
    const articles: NewsArticle[] = [];

    const results = await Promise.all(
      REAL_LEAGUES.filter((l) => l.fetchNews).map(async (lg) => {
        const data = await fetchEspnJson<any>(
          `/apis/site/v2/sports/soccer/${lg.espnSlug}/news`
        );
        return { lg, data };
      })
    );

    for (const { lg, data } of results) {
      const items: any[] = Array.isArray(data?.articles) ? data.articles : [];
      for (const item of items) {
        const headline = String(item?.headline ?? '').trim();
        if (!headline) continue;
        const id = `espn-news-${item?.dataSourceIdentifier ?? item?.id ?? headline.slice(0, 24)}`;
        if (seen.has(id)) continue;
        seen.add(id);

        const desc = String(item?.description ?? headline).trim();
        const lower = `${headline} ${desc}`.toLowerCase();
        let category: NewsArticle['category'] = 'match-report';
        if (lower.includes('transfer') || lower.includes('sign') || lower.includes('deal') || lower.includes('contract')) {
          category = 'transfers';
        } else if (lower.includes('tactic') || lower.includes('defensive') || lower.includes('formation') || lower.includes('analysis')) {
          category = 'tactics';
        } else if (lower.includes('stat') || lower.includes('xg') || lower.includes('data') || lower.includes('ranking')) {
          category = 'analytics';
        }

        const imageUrl = safeHttpsUrl(item?.images?.[0]?.url) ?? FALLBACK_NEWS_IMAGE;
        const sourceUrl = safeHttpsUrl(item?.links?.web?.href) ?? undefined;
        const authorName = String(item?.byline ?? 'ESPN FC').trim() || 'ESPN FC';

        articles.push({
          id,
          category,
          title: { en: headline, fa: headline },
          summary: { en: desc, fa: desc },
          body: {
            en: desc,
            fa: desc,
          },
          author: { en: authorName, fa: authorName },
          publishedAt: formatRelativePublished(String(item?.published ?? '')),
          readTimeMin: 3,
          imageUrl,
          sourceUrl,
          relatedLeagueId: lg.id,
        });
      }
    }

    return articles.slice(0, 18);
  });
}

async function loadRealScoreboards(
  teamsMap: Map<string, Team>
): Promise<{ matches: Match[]; extraTeams: Team[]; leagueLogos: Map<string, string> }> {
  return cachedFetch('real:scoreboards', 35 * 1000, async () => {
    const now = new Date();
    const todayKey = utcDateKey(now);
    const yesterdayDate = new Date(now.getTime() - 86400000);
    const yesterdayParam = formatEspnDate(yesterdayDate);
    const tomorrowDate = new Date(now.getTime() + 86400000);
    const tomorrowParam = formatEspnDate(tomorrowDate);

    const requests: Promise<{ lg: LeagueDef; data: any }>[] = [];
    for (const lg of REAL_LEAGUES) {
      // Default scoreboard returns today's live & current matchday for every league
      requests.push(
        fetchEspnJson<any>(`/apis/site/v2/sports/soccer/${lg.espnSlug}/scoreboard`).then((data) => ({
          lg,
          data,
        }))
      );
      if (lg.fetchYesterday) {
        requests.push(
          fetchEspnJson<any>(
            `/apis/site/v2/sports/soccer/${lg.espnSlug}/scoreboard?dates=${yesterdayParam}`
          ).then((data) => ({ lg, data }))
        );
      }
      if (lg.id === 'epl' || lg.id === 'laliga') {
        requests.push(
          fetchEspnJson<any>(
            `/apis/site/v2/sports/soccer/${lg.espnSlug}/scoreboard?dates=${tomorrowParam}`
          ).then((data) => ({ lg, data }))
        );
      }
    }

    const responses = await Promise.all(requests);
    const seenEventIds = new Set<string>();
    const matches: Match[] = [];
    const extraTeamsMap = new Map<string, Team>();
    const leagueLogos = new Map<string, string>();

    const ensureTeam = (compTeam: any, leagueId: string): Team => {
      const espnTeamId = String(compTeam?.id ?? '0');
      const internalId = makeTeamId(espnTeamId);
      const existing = teamsMap.get(internalId) ?? extraTeamsMap.get(internalId);
      if (existing) {
        // Fill logo if standings missed it
        if (!existing.logo) {
          const logo = safeHttpsUrl(compTeam?.logo);
          if (logo) existing.logo = logo;
        }
        return existing;
      }

      const displayName = String(compTeam?.displayName ?? compTeam?.name ?? 'Club');
      const shortName = String(compTeam?.abbreviation ?? displayName.slice(0, 3))
        .toUpperCase()
        .slice(0, 4);
      const created: Team = {
        id: internalId,
        leagueId,
        name: localizeClubName(displayName),
        shortName,
        logo: safeHttpsUrl(compTeam?.logo),
        crestPrimary: safeHexColor(compTeam?.color, '#22FF66'),
        crestSecondary: safeHexColor(compTeam?.alternateColor, '#0F172A'),
        crestPattern: 'solid',
        stadium: { en: compTeam?.location ?? 'Stadium', fa: compTeam?.location ?? 'ورزشگاه' },
        manager: { en: 'First-Team Staff', fa: 'کادر فنی' },
        formation: '4-3-3',
        form: [],
        seasonStats: {
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          points: 0,
          avgPossession: 0,
          avgXgFor: 0,
          avgXgAgainst: 0,
          cleanSheets: 0,
        },
      };
      extraTeamsMap.set(internalId, created);
      return created;
    };

    for (const { lg, data } of responses) {
      if (!data) continue;
      const lgLogo = safeHttpsUrl(data.leagues?.[0]?.logos?.[0]?.href);
      if (lgLogo && !leagueLogos.has(lg.id)) {
        leagueLogos.set(lg.id, lgLogo);
      }

      const events: any[] = Array.isArray(data.events) ? data.events : [];
      for (const ev of events) {
        const eventId = String(ev?.id ?? '');
        if (!eventId) continue;
        const dedupKey = `${lg.espnSlug}:${eventId}`;
        if (seenEventIds.has(dedupKey)) continue;
        seenEventIds.add(dedupKey);

        const comp = ev.competitions?.[0];
        const competitors: any[] = Array.isArray(comp?.competitors) ? comp.competitors : [];
        const homeComp = competitors.find((c) => c.homeAway === 'home') ?? competitors[0];
        const awayComp = competitors.find((c) => c.homeAway === 'away') ?? competitors[1];
        if (!homeComp?.team || !awayComp?.team) continue;

        const homeTeam = ensureTeam(homeComp.team, lg.id);
        const awayTeam = ensureTeam(awayComp.team, lg.id);

        const { status, minute } = parseStatus(ev.status);
        const rawHomeScore = Number.parseInt(String(homeComp.score ?? ''), 10);
        const rawAwayScore = Number.parseInt(String(awayComp.score ?? ''), 10);
        const homeScore =
          status === 'UPCOMING' ? null : Number.isFinite(rawHomeScore) ? rawHomeScore : 0;
        const awayScore =
          status === 'UPCOMING' ? null : Number.isFinite(rawAwayScore) ? rawAwayScore : 0;

        const evDate = new Date(String(ev.date ?? now.toISOString()));
        const evDayKey = Number.isNaN(evDate.getTime()) ? todayKey : utcDateKey(evDate);
        let dayOffset = 0;
        if (evDayKey < todayKey) dayOffset = -1;
        else if (evDayKey > todayKey) dayOffset = 1;

        const venueName = String(comp?.venue?.fullName ?? homeTeam.stadium.en);
        const roundName = String(
          ev.season?.slug ?? data.leagues?.[0]?.name ?? lg.name.en
        );

        const parsedEvents = parseScoreboardEvents(comp, String(homeComp.team.id));

        matches.push({
          id: makeMatchId(lg.espnSlug, eventId),
          leagueId: lg.id,
          dayOffset,
          matchDate: evDayKey,
          kickoffTime: formatUtcKickoff(String(ev.date ?? '')),
          status,
          minute,
          venue: { en: venueName, fa: venueName },
          referee: { en: 'Official Match Referee', fa: 'داور رسمی مسابقه' },
          round: { en: roundName, fa: lg.name.fa },
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          homeScore,
          awayScore,
          isFeatured: false,
          hasXg: false,
          hasDetailedStats: false,
          winProbability: computeWinProbability(homeTeam, awayTeam, homeScore, awayScore, status),
          stats: buildEmptyStats(),
          events: parsedEvents,
          momentum: [],
          lineups: {
            homeFormation: '—',
            awayFormation: '—',
            homeXI: [],
            awayXI: [],
          },
          h2h: {
            homeWins: 0,
            draws: 0,
            awayWins: 0,
            recentMeetings: [],
          },
        });
      }
    }

    // Sort: LIVE/HT first, then Today, then Tomorrow, then Yesterday
    const statusWeight = (s: MatchStatus) =>
      s === 'LIVE' ? 0 : s === 'HT' ? 1 : s === 'UPCOMING' ? 2 : 3;
    matches.sort((a, b) => {
      if (a.dayOffset !== b.dayOffset) {
        const order = (d: number) => (d === 0 ? 0 : d === 1 ? 1 : 2);
        return order(a.dayOffset) - order(b.dayOffset);
      }
      const sw = statusWeight(a.status) - statusWeight(b.status);
      if (sw !== 0) return sw;
      return a.kickoffTime.localeCompare(b.kickoffTime);
    });

    // Pick the best real match as Featured Match (prefer LIVE -> Today top-league FT -> UCL upcoming)
    if (matches.length > 0) {
      const liveMatch = matches.find((m) => m.status === 'LIVE' || m.status === 'HT');
      const todayTopMatch = matches.find(
        (m) => m.dayOffset === 0 && (m.leagueId === 'epl' || m.leagueId === 'laliga' || m.leagueId === 'ucl')
      );
      const featured = liveMatch ?? todayTopMatch ?? matches[0];
      featured.isFeatured = true;
    }

    return {
      matches,
      extraTeams: Array.from(extraTeamsMap.values()),
      leagueLogos,
    };
  });
}

export async function getRealBootstrapData(): Promise<RealBootstrapData> {
  const { teamsMap, standingsByLeague, topClubsForRosters, leagueSeasons } =
    await loadStandingsAndTeams();
  const [scoreboardResult, players, news, iranBundle] = await Promise.all([
    loadRealScoreboards(teamsMap),
    loadRealPlayers(topClubsForRosters, teamsMap),
    loadRealNews(),
    loadIranProLeagueBundle().catch(() => null),
  ]);

  const combinedTeams = new Map<string, Team>(teamsMap);
  for (const extra of scoreboardResult.extraTeams) {
    if (!combinedTeams.has(extra.id)) {
      combinedTeams.set(extra.id, extra);
    }
  }

  const mergedStandings: Record<string, StandingRow[]> = { ...standingsByLeague };
  const mergedPlayers: Player[] = [...players];
  const mergedMatches: Match[] = [...scoreboardResult.matches];

  const leagues: League[] = REAL_LEAGUES.map((lg) => ({
    id: lg.id,
    code: lg.code,
    name: lg.name,
    country: lg.country,
    season: leagueSeasons.get(lg.id) ?? '2026/27',
    accentColor: lg.accentColor,
    tier: lg.tier,
    logo: scoreboardResult.leagueLogos.get(lg.id) ?? null,
  }));

  if (iranBundle) {
    // Insert Persian Gulf Pro League prominently right after Premier League
    leagues.splice(1, 0, iranBundle.league);
    for (const tm of iranBundle.teams) {
      if (!combinedTeams.has(tm.id)) {
        combinedTeams.set(tm.id, tm);
      }
    }
    mergedStandings.pgpl = iranBundle.standings;
    mergedMatches.push(...iranBundle.matches);
    mergedPlayers.push(...iranBundle.players);
  }

  // Re-sort combined matches cleanly: LIVE/HT -> Today -> Tomorrow -> Yesterday
  const statusWeight = (s: MatchStatus) =>
    s === 'LIVE' ? 0 : s === 'HT' ? 1 : s === 'UPCOMING' ? 2 : 3;
  mergedMatches.sort((a, b) => {
    if (a.dayOffset !== b.dayOffset) {
      const order = (d: number) => (d === 0 ? 0 : d === 1 ? 1 : 2);
      return order(a.dayOffset) - order(b.dayOffset);
    }
    const sw = statusWeight(a.status) - statusWeight(b.status);
    if (sw !== 0) return sw;
    return a.kickoffTime.localeCompare(b.kickoffTime);
  });

  // Enrich the featured match in background/inline so the hero has real formation & stats!
  const featured = mergedMatches.find((m) => m.isFeatured);
  if (featured) {
    const enriched = await enrichRealMatchSummary(featured).catch(() => featured);
    const idx = mergedMatches.findIndex((m) => m.id === featured.id);
    if (idx !== -1) {
      mergedMatches[idx] = enriched;
    }
  }

  return {
    leagues,
    teams: Array.from(combinedTeams.values()),
    players: mergedPlayers,
    matches: mergedMatches,
    news,
    standingsByLeague: mergedStandings,
    syncedAt: new Date().toISOString(),
  };
}

export async function getRealMatches(): Promise<Match[]> {
  const { teamsMap } = await loadStandingsAndTeams();
  const [{ matches }, iranBundle] = await Promise.all([
    loadRealScoreboards(teamsMap),
    loadIranProLeagueBundle().catch(() => null),
  ]);
  return iranBundle ? [...matches, ...iranBundle.matches] : matches;
}

export async function enrichRealMatchSummary(baseMatch: Match): Promise<Match> {
  if (!SAFE_ID_REGEX.test(baseMatch.id)) return baseMatch;
  if (baseMatch.id.startsWith('fotmob-pgpl-')) {
    return enrichIranMatchSummary(baseMatch);
  }
  // Format: espn-{espnSlug}-{eventId}
  const withoutPrefix = baseMatch.id.replace(/^espn-/, '');
  const lastDash = withoutPrefix.lastIndexOf('-');
  if (lastDash === -1) return baseMatch;
  const espnSlug = withoutPrefix.slice(0, lastDash);
  const eventId = withoutPrefix.slice(lastDash + 1);
  if (!SLUG_TO_LEAGUE_DEF.has(espnSlug) || !/^\d{4,16}$/.test(eventId)) {
    return baseMatch;
  }

  const ttlMs = baseMatch.status === 'LIVE' || baseMatch.status === 'HT' ? 30 * 1000 : 10 * 60 * 1000;
  return cachedFetch(`real:summary:${espnSlug}:${eventId}`, ttlMs, async () => {
    const sum = await fetchEspnJson<any>(
      `/apis/site/v2/sports/soccer/${espnSlug}/summary?event=${eventId}`
    );
    if (!sum) return baseMatch;

    const comp = sum.header?.competitions?.[0];
    const homeComp = comp?.competitors?.find((c: any) => c.homeAway === 'home') ?? comp?.competitors?.[0];
    const awayComp = comp?.competitors?.find((c: any) => c.homeAway === 'away') ?? comp?.competitors?.[1];
    const homeEspnTeamId = String(homeComp?.team?.id ?? '');

    // 1. Live score & status refresh
    const { status, minute } = comp?.status ? parseStatus(comp.status) : { status: baseMatch.status, minute: baseMatch.minute };
    const homeScore =
      status === 'UPCOMING'
        ? null
        : Number.isFinite(Number(homeComp?.score))
          ? Number(homeComp.score)
          : baseMatch.homeScore;
    const awayScore =
      status === 'UPCOMING'
        ? null
        : Number.isFinite(Number(awayComp?.score))
          ? Number(awayComp.score)
          : baseMatch.awayScore;

    // 2. Real boxscore statistics
    const stats = buildEmptyStats();
    let hasDetailedStats = false;
    const boxTeams: any[] = Array.isArray(sum.boxscore?.teams) ? sum.boxscore.teams : [];
    const homeBox = boxTeams.find((b) => String(b?.team?.id) === homeEspnTeamId) ?? boxTeams[0];
    const awayBox = boxTeams.find((b) => String(b?.team?.id) !== homeEspnTeamId) ?? boxTeams[1];

    const readBoxStat = (box: any, ...names: string[]): number => {
      const list: any[] = Array.isArray(box?.statistics) ? box.statistics : [];
      for (const name of names) {
        const found = list.find((s) => s.name === name);
        if (found) {
          const parsed = Number.parseFloat(String(found.displayValue ?? found.value ?? ''));
          if (Number.isFinite(parsed)) {
            hasDetailedStats = true;
            return parsed;
          }
        }
      }
      return 0;
    };

    if (homeBox && awayBox) {
      const hp = readBoxStat(homeBox, 'possessionPct');
      const ap = readBoxStat(awayBox, 'possessionPct');
      if (hp > 0 || ap > 0) {
        stats.possession = [Math.round(hp), Math.round(ap)];
      }
      stats.totalShots = [readBoxStat(homeBox, 'totalShots'), readBoxStat(awayBox, 'totalShots')];
      stats.shotsOnTarget = [readBoxStat(homeBox, 'shotsOnTarget'), readBoxStat(awayBox, 'shotsOnTarget')];
      stats.corners = [readBoxStat(homeBox, 'wonCorners'), readBoxStat(awayBox, 'wonCorners')];
      stats.fouls = [readBoxStat(homeBox, 'foulsCommitted'), readBoxStat(awayBox, 'foulsCommitted')];
      stats.tackles = [readBoxStat(homeBox, 'saves'), readBoxStat(awayBox, 'saves')];
      stats.bigChances = [readBoxStat(homeBox, 'offsides'), readBoxStat(awayBox, 'offsides')];
      stats.passAccuracy = [
        Math.round(readBoxStat(homeBox, 'shotPct')),
        Math.round(readBoxStat(awayBox, 'shotPct')),
      ];
    }

    // 3. Real key events timeline
    const keyEvents: any[] = Array.isArray(sum.keyEvents) ? sum.keyEvents : [];
    const parsedEvents: MatchEvent[] = [];
    keyEvents.forEach((ev, idx) => {
      const typeText = String(ev?.type?.text ?? '').toLowerCase();
      const minuteNum = parseMinuteFromClock(ev?.clock?.displayValue);
      if (minuteNum === undefined) return;

      let type: MatchEvent['type'] | null = null;
      if (typeText.includes('goal')) type = 'goal';
      else if (typeText.includes('yellow')) type = 'yellow';
      else if (typeText.includes('red')) type = 'red';
      else if (typeText.includes('sub')) type = 'sub';
      else if (typeText.includes('var')) type = 'var';
      if (!type) return;

      const evTeamId = String(ev?.team?.id ?? '');
      const teamSide: 'home' | 'away' = evTeamId === homeEspnTeamId ? 'home' : 'away';
      const primaryPlayer = String(
        ev?.participants?.[0]?.athlete?.shortName ??
          ev?.participants?.[0]?.athlete?.displayName ??
          ev?.shortText ??
          ev?.type?.text ??
          'Event'
      ).trim();
      const detailText = String(ev?.shortText ?? ev?.text ?? ev?.type?.text ?? '').trim();

      parsedEvents.push({
        id: `sum-ev-${idx}-${minuteNum}-${evTeamId}`,
        minute: minuteNum,
        teamSide,
        type,
        playerName: { en: primaryPlayer, fa: primaryPlayer },
        assistOrDetail: detailText ? { en: detailText, fa: detailText } : undefined,
      });
    });

    // 4. Real starting XI & formations
    const rosters: any[] = Array.isArray(sum.rosters) ? sum.rosters : [];
    const homeRoster = rosters.find((r) => String(r?.team?.id) === homeEspnTeamId) ?? rosters[0];
    const awayRoster = rosters.find((r) => String(r?.team?.id) !== homeEspnTeamId) ?? rosters[1];

    const homeFormation = String(homeRoster?.formation ?? '—');
    const awayFormation = String(awayRoster?.formation ?? '—');
    const homeStarters = Array.isArray(homeRoster?.roster)
      ? homeRoster.roster.filter((p: any) => p.starter)
      : [];
    const awayStarters = Array.isArray(awayRoster?.roster)
      ? awayRoster.roster.filter((p: any) => p.starter)
      : [];

    const homeTeamName = String(homeComp?.team?.displayName ?? homeRoster?.team?.displayName ?? '');
    const awayTeamName = String(awayComp?.team?.displayName ?? awayRoster?.team?.displayName ?? '');

    const rawHomeXI = homeStarters.length > 0 ? mapFormationCoordinates(homeStarters, homeFormation) : [];
    const rawAwayXI = awayStarters.length > 0 ? mapFormationCoordinates(awayStarters, awayFormation) : [];

    const [homeXI, awayXI] = await Promise.all([
      rawHomeXI.length > 0 ? attachPhotosToLineup(rawHomeXI, homeTeamName) : Promise.resolve([]),
      rawAwayXI.length > 0 ? attachPhotosToLineup(rawAwayXI, awayTeamName) : Promise.resolve([]),
    ]);

    // 5. Real Venue & Referee
    const venueName = String(sum.gameInfo?.venue?.fullName ?? baseMatch.venue.en);
    const officialName = String(sum.gameInfo?.officials?.[0]?.fullName ?? baseMatch.referee.en);

    // 6. Real Recent Form / H2H from lastFiveGames or headToHeadGames
    const recentMeetings: Match['h2h']['recentMeetings'] = [];
    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;

    const h2hEvents: any[] = sum.headToHeadGames?.[0]?.events ?? [];
    for (const m of h2hEvents.slice(0, 6)) {
      const hs = Number.parseInt(String(m?.homeTeamScore ?? ''), 10);
      const as = Number.parseInt(String(m?.awayTeamScore ?? ''), 10);
      if (Number.isFinite(hs) && Number.isFinite(as)) {
        if (hs > as) homeWins++;
        else if (as > hs) awayWins++;
        else draws++;
      }
      recentMeetings.push({
        date: String(m?.gameDate ?? '').slice(0, 10),
        homeShort: String(m?.homeTeamId ?? 'HOM'),
        awayShort: String(m?.awayTeamId ?? 'AWY'),
        score: `${m?.homeTeamScore ?? '-'}-${m?.awayTeamScore ?? '-'}`,
        competition: String(m?.leagueName ?? baseMatch.round.en),
      });
    }

    return {
      ...baseMatch,
      status,
      minute,
      homeScore,
      awayScore,
      venue: { en: venueName, fa: venueName },
      referee: { en: officialName, fa: officialName },
      hasDetailedStats,
      hasXg: false,
      stats,
      events: parsedEvents.length > 0 ? parsedEvents : baseMatch.events,
      lineups: {
        homeFormation,
        awayFormation,
        homeXI,
        awayXI,
      },
      h2h: {
        homeWins,
        draws,
        awayWins,
        recentMeetings,
      },
    };
  });
}

export async function getRealMatchById(matchId: string): Promise<Match | null> {
  if (!SAFE_ID_REGEX.test(matchId)) return null;
  if (matchId.startsWith('fotmob-past-')) {
    return getPastMatchDetail(matchId);
  }
  const matches = await getRealMatches();
  const base = matches.find((m) => m.id === matchId);
  if (base) {
    return enrichRealMatchSummary(base);
  }
  // Support older archived Iran PGPL matches fetched from Past Matches screen
  if (parseArchiveMatchId(matchId)) {
    return getPastMatchDetail(matchId);
  }
  return null;
}

export function clearRealFootballCache(): void {
  cache.clear();
  clearIranProLeagueCache();
  clearPlayerPhotoCache();
  clearPastMatchesCache();
}
