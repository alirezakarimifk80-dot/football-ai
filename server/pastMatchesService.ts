import type {
  ExtraMatchStat,
  LineupPlayer,
  LocalizedText,
  Match,
  MatchEvent,
  MomentumPoint,
  PlayerOfTheMatch,
  Team,
} from '../src/types/football.ts';
import { ALLOWED_PROVIDER_HOSTS } from '../backend/src/config/env.ts';
import { fotmobPlayerPhotoUrl } from './playerPhotoService.ts';

const FOTMOB_BASE = 'https://www.fotmob.com';

interface ArchiveLeagueConfig {
  id: string;
  fotmobId: number;
  name: LocalizedText;
}

export const ARCHIVE_LEAGUES: ArchiveLeagueConfig[] = [
  { id: 'epl', fotmobId: 47, name: { en: 'Premier League', fa: 'لیگ برتر انگلیس' } },
  { id: 'pgpl', fotmobId: 523, name: { en: 'Persian Gulf Pro League', fa: 'لیگ برتر خلیج فارس ایران' } },
  { id: 'ucl', fotmobId: 42, name: { en: 'Champions League', fa: 'لیگ قهرمانان اروپا' } },
  { id: 'laliga', fotmobId: 87, name: { en: 'LaLiga', fa: 'لالیگا اسپانیا' } },
  { id: 'seriea', fotmobId: 55, name: { en: 'Serie A', fa: 'سری آ ایتالیا' } },
  { id: 'bundesliga', fotmobId: 54, name: { en: 'Bundesliga', fa: 'بوندس‌لیگا آلمان' } },
  { id: 'ligue1', fotmobId: 53, name: { en: 'Ligue 1', fa: 'لیگ ۱ فرانسه' } },
  { id: 'acl', fotmobId: 525, name: { en: 'AFC Champions League', fa: 'لیگ نخبگان آسیا' } },
];

export const VALID_ARCHIVE_LEAGUE_IDS = new Set(['all', ...ARCHIVE_LEAGUES.map((l) => l.id)]);

const ARCHIVE_LEAGUE_MAP = new Map(ARCHIVE_LEAGUES.map((l) => [l.id, l]));

const PERSIAN_CLUB_NAMES: Record<string, string> = {
  arsenal: 'آرسنال',
  'manchester city': 'منچستر سیتی',
  'manchester united': 'منچستر یونایتد',
  liverpool: 'لیورپول',
  chelsea: 'چلسی',
  tottenham: 'تاتنهام',
  'tottenham hotspur': 'تاتنهام',
  'aston villa': 'استون ویلا',
  newcastle: 'نیوکاسل',
  'newcastle united': 'نیوکاسل',
  brighton: 'برایتون',
  'brighton & hove albion': 'برایتون',
  fulham: 'فولام',
  brentford: 'برنتفورد',
  everton: 'اورتون',
  'west ham': 'وستهام',
  'west ham united': 'وستهام',
  'nottingham forest': 'ناتینگهام فارست',
  'crystal palace': 'کریستال پالاس',
  bournemouth: 'بورنموث',
  wolves: 'ولورهمپتون',
  'wolverhampton wanderers': 'ولورهمپتون',
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
  girona: 'خیرونا',
  'bayern munich': 'بایرن مونیخ',
  'bayern münchen': 'بایرن مونیخ',
  'borussia dortmund': 'بروسیا دورتموند',
  'bayer leverkusen': 'بایر لورکوزن',
  'rb leipzig': 'لایپزیگ',
  'eintracht frankfurt': 'آینتراخت فرانکفورت',
  'vfb stuttgart': 'اشتوتگارت',
  inter: 'اینتر میلان',
  'inter milan': 'اینتر میلان',
  'ac milan': 'آث میلان',
  milan: 'آث میلان',
  juventus: 'یوونتوس',
  napoli: 'ناپولی',
  atalanta: 'آتالانتا',
  roma: 'آاس رم',
  'as roma': 'آاس رم',
  lazio: 'لاتزیو',
  fiorentina: 'فیورنتینا',
  bologna: 'بولونیا',
  'paris saint-germain': 'پاری سن ژرمن',
  psg: 'پاری سن ژرمن',
  marseille: 'مارسی',
  monaco: 'موناکو',
  'as monaco': 'موناکو',
  lyon: 'لیون',
  lille: 'لیل',
  nice: 'نیس',
  sepahan: 'سپاهان اصفهان',
  persepolis: 'پرسپولیس تهران',
  esteghlal: 'استقلال تهران',
  tractor: 'تراکتور تبریز',
  'foolad khuzestan': 'فولاد خوزستان',
  'aluminium arak': 'آلومینیوم اراک',
  'fajr sepasi': 'فجر سپاسی شیراز',
  'chadormalu ardakan sc': 'چادرملو اردکان',
  'gol gohar': 'گل‌گهر سیرجان',
  'kheybar khorramabad': 'خیبر خرم‌آباد',
  'kheibar khorramabad': 'خیبر خرم‌آباد',
  paykan: 'پیکان تهران',
  'zob ahan': 'ذوب‌آهن اصفهان',
  'nassaji mazandaran fc': 'نساجی مازندران',
  'sanat naft abadan': 'صنعت نفت آبادان',
  'esteghlal khuzestan': 'استقلال خوزستان',
  malavan: 'ملوان بندرانزلی',
  'shams azar qazvin': 'شمس‌آذر قزوین',
  'mes shahr babak': 'مس شهربابک',
  'mes rafsanjan': 'مس رفسنجان',
  havadar: 'هوادار تهران',
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
  porto: 'پورتو',
  'fc porto': 'پورتو',
  ajax: 'آژاکس',
  'psv eindhoven': 'آیندهوون',
  celtic: 'سلتیک',
};

interface CacheSlot<T> {
  value: T;
  expiresAt: number;
}

const pastCache = new Map<string, CacheSlot<any>>();
const pastInFlight = new Map<string, Promise<any>>();

async function cachedPastFetch<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = pastCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const inflight = pastInFlight.get(key);
  if (inflight) return inflight as Promise<T>;

  const p = loader()
    .then((val) => {
      pastCache.set(key, { value: val, expiresAt: Date.now() + ttlMs });
      pastInFlight.delete(key);
      return val;
    })
    .catch((err) => {
      pastInFlight.delete(key);
      throw err;
    });

  pastInFlight.set(key, p);
  return p;
}

async function fetchFotmobJson<T>(pathAndQuery: string): Promise<T | null> {
  const url = new URL(`${FOTMOB_BASE}${pathAndQuery}`);
  if (url.protocol !== 'https:' || !ALLOWED_PROVIDER_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(`Blocked outbound host: ${url.hostname}`);
  }
  try {
    const signal =
      typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(8500)
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

function localizeClub(enName: string): LocalizedText {
  const clean = enName.trim();
  const key = clean.toLowerCase();
  return { en: clean, fa: PERSIAN_CLUB_NAMES[key] ?? clean };
}

function deriveShortName(enName: string): string {
  const cleaned = enName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return parts
      .slice(0, 3)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }
  return (cleaned.slice(0, 3) || 'FC').toUpperCase();
}

function makeArchiveTeamId(leagueId: string, fotmobTeamId: string | number): string {
  if (leagueId === 'pgpl') return `pgpl-t-${String(fotmobTeamId)}`;
  return `fm-t-${String(fotmobTeamId)}`;
}

export function makeArchiveMatchId(leagueId: string, fotmobMatchId: string | number): string {
  if (leagueId === 'pgpl') return `fotmob-pgpl-${String(fotmobMatchId)}`;
  return `fotmob-past-${leagueId}-${String(fotmobMatchId)}`;
}

export function parseArchiveMatchId(
  matchId: string
): { leagueId: string; fotmobMatchId: string } | null {
  if (matchId.startsWith('fotmob-pgpl-')) {
    const raw = matchId.slice('fotmob-pgpl-'.length);
    if (/^\d{4,16}$/.test(raw)) return { leagueId: 'pgpl', fotmobMatchId: raw };
    return null;
  }
  if (matchId.startsWith('fotmob-past-')) {
    const rest = matchId.slice('fotmob-past-'.length);
    const lastDash = rest.lastIndexOf('-');
    if (lastDash === -1) return null;
    const leagueId = rest.slice(0, lastDash);
    const fotmobMatchId = rest.slice(lastDash + 1);
    if (ARCHIVE_LEAGUE_MAP.has(leagueId) && /^\d{4,16}$/.test(fotmobMatchId)) {
      return { leagueId, fotmobMatchId };
    }
  }
  return null;
}

function parseScoresStr(scoreStr: unknown): [number, number] {
  if (typeof scoreStr !== 'string') return [0, 0];
  const parts = scoreStr.split('-').map((s) => Number.parseInt(s.trim(), 10));
  if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return [parts[0], parts[1]];
  }
  return [0, 0];
}

function formatUtcKickoff(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
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

function buildArchiveTeam(leagueId: string, fotmobTeamId: string | number, enName: string): Team {
  const id = makeArchiveTeamId(leagueId, fotmobTeamId);
  return {
    id,
    leagueId,
    name: localizeClub(enName),
    shortName: deriveShortName(enName),
    logo: `https://images.fotmob.com/image_resources/logo/teamlogo/${String(fotmobTeamId)}.png`,
    crestPrimary: '#22FF66',
    crestSecondary: '#0F172A',
    crestPattern: 'solid',
    stadium: { en: `${enName} Stadium`, fa: `ورزشگاه ${localizeClub(enName).fa}` },
    manager: { en: 'First-Team Staff', fa: 'کادر فنی تیم اول' },
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
}

export interface PastMatchesBundle {
  matches: Match[];
  teams: Team[];
}

async function loadPastMatchesForLeague(
  cfg: ArchiveLeagueConfig,
  limit: number
): Promise<PastMatchesBundle> {
  return cachedPastFetch(`past:league:${cfg.id}:${limit}`, 10 * 60 * 1000, async () => {
    const data = await fetchFotmobJson<any>(`/api/data/leagues?id=${cfg.fotmobId}`);
    if (!data) return { matches: [], teams: [] };

    const allFixtures: any[] = Array.isArray(data.fixtures?.allMatches)
      ? data.fixtures.allMatches
      : [];

    const finished = allFixtures
      .filter(
        (fx) =>
          fx?.id &&
          fx?.home?.id &&
          fx?.away?.id &&
          Boolean(fx?.status?.finished) &&
          !Boolean(fx?.status?.cancelled)
      )
      .sort((a, b) =>
        String(b?.status?.utcTime ?? '').localeCompare(String(a?.status?.utcTime ?? ''))
      )
      .slice(0, limit);

    const teamsMap = new Map<string, Team>();
    const matches: Match[] = [];

    for (const fx of finished) {
      const homeTeamId = makeArchiveTeamId(cfg.id, fx.home.id);
      const awayTeamId = makeArchiveTeamId(cfg.id, fx.away.id);

      if (!teamsMap.has(homeTeamId)) {
        teamsMap.set(homeTeamId, buildArchiveTeam(cfg.id, fx.home.id, String(fx.home.name ?? 'Home')));
      }
      if (!teamsMap.has(awayTeamId)) {
        teamsMap.set(awayTeamId, buildArchiveTeam(cfg.id, fx.away.id, String(fx.away.name ?? 'Away')));
      }

      const [homeScore, awayScore] = parseScoresStr(fx.status?.scoreStr);
      const utcIso = String(fx.status?.utcTime ?? '');
      const matchDate = utcIso.length >= 10 ? utcIso.slice(0, 10) : undefined;
      const roundNum = fx.roundName ?? fx.round ?? '';
      const roundLabel: LocalizedText = roundNum
        ? { en: `Matchweek ${roundNum}`, fa: `هفته ${roundNum}` }
        : cfg.name;

      const winProbability =
        homeScore > awayScore
          ? { home: 100, draw: 0, away: 0 }
          : awayScore > homeScore
            ? { home: 0, draw: 0, away: 100 }
            : { home: 0, draw: 100, away: 0 };

      matches.push({
        id: makeArchiveMatchId(cfg.id, fx.id),
        leagueId: cfg.id,
        dayOffset: -1,
        matchDate,
        kickoffTime: formatUtcKickoff(utcIso),
        status: 'FT',
        venue: teamsMap.get(homeTeamId)?.stadium ?? { en: 'Stadium', fa: 'ورزشگاه' },
        referee: { en: 'Official Match Referee', fa: 'داور رسمی مسابقه' },
        round: roundLabel,
        homeTeamId,
        awayTeamId,
        homeScore,
        awayScore,
        isFeatured: false,
        hasXg: false,
        hasDetailedStats: false,
        winProbability,
        stats: buildEmptyStats(),
        events: [],
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

    return {
      matches,
      teams: Array.from(teamsMap.values()),
    };
  });
}

export async function getPastMatchesArchive(leagueFilter = 'all'): Promise<PastMatchesBundle> {
  const safeLeague = VALID_ARCHIVE_LEAGUE_IDS.has(leagueFilter) ? leagueFilter : 'all';

  if (safeLeague !== 'all') {
    const cfg = ARCHIVE_LEAGUE_MAP.get(safeLeague)!;
    return loadPastMatchesForLeague(cfg, 40);
  }

  // Fetch latest 14 finished matches per league in parallel (8 subrequests, cached 10m)
  const bundles = await Promise.all(
    ARCHIVE_LEAGUES.map((cfg) =>
      loadPastMatchesForLeague(cfg, 14).catch(() => ({ matches: [], teams: [] }))
    )
  );

  const teamsMap = new Map<string, Team>();
  const matches: Match[] = [];

  for (const b of bundles) {
    for (const tm of b.teams) {
      if (!teamsMap.has(tm.id)) teamsMap.set(tm.id, tm);
    }
    matches.push(...b.matches);
  }

  matches.sort((a, b) => {
    const dateDiff = (b.matchDate ?? '').localeCompare(a.matchDate ?? '');
    if (dateDiff !== 0) return dateDiff;
    return b.kickoffTime.localeCompare(a.kickoffTime);
  });

  return {
    matches,
    teams: Array.from(teamsMap.values()),
  };
}

function mapPositionId(usualPosId: unknown, fallbackIdx: number): string {
  const n = Number(usualPosId);
  if (n === 0) return 'GK';
  if (n === 1) return 'DEF';
  if (n === 2) return 'MID';
  if (n === 3) return 'FWD';
  return fallbackIdx === 0 ? 'GK' : 'MID';
}

function parseStatNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  // Handle strings like "514 (88%)" -> prefer percentage when parentheses present, else first number
  const pctMatch = raw.match(/\((\d+(?:\.\d+)?)%\)/);
  if (pctMatch) {
    const n = Number.parseFloat(pctMatch[1]);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number.parseFloat(raw.replace('%', '').trim());
  return Number.isFinite(n) ? n : null;
}

function parseStatLeadingCount(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const n = Number.parseFloat(raw.trim());
  return Number.isFinite(n) ? n : null;
}

function mapFotmobLineupPlayers(
  rawList: any[],
  isStarter: boolean,
  potmId: string | null
): LineupPlayer[] {
  return rawList.map((st, idx) => {
    const name = String(st?.name ?? 'Player').trim();
    const num = Number.parseInt(String(st?.shirtNumber ?? '0'), 10) || 0;
    const rawRating = Number(st?.performance?.rating ?? 0);
    const rating = Number.isFinite(rawRating) && rawRating > 0 ? Number(rawRating.toFixed(1)) : 0;
    const pos = mapPositionId(st?.usualPlayingPositionId, isStarter ? idx : 1);

    // FotMob horizontalLayout gives x (depth 0..1) and y (width 0..1)
    const lx = Number(st?.horizontalLayout?.y);
    const ly = Number(st?.horizontalLayout?.x);
    const x = Number.isFinite(lx)
      ? Math.max(10, Math.min(90, Math.round(10 + lx * 80)))
      : idx === 0
        ? 50
        : 20 + ((idx * 17) % 64);
    const y = Number.isFinite(ly)
      ? Math.max(10, Math.min(88, Math.round(12 + ly * 76)))
      : idx === 0
        ? 11
        : Math.min(86, 28 + Math.floor((idx - 1) / 3) * 20);

    const perfEvents: any[] = Array.isArray(st?.performance?.events) ? st.performance.events : [];
    let goals = 0;
    let assists = 0;
    let yellowCard = false;
    let redCard = false;
    for (const pe of perfEvents) {
      const t = String(pe?.type ?? '').toLowerCase();
      if (t === 'goal') goals += 1;
      else if (t === 'assist') assists += 1;
      else if (t === 'yellowcard') yellowCard = true;
      else if (t === 'redcard' || t === 'secondyellow') redCard = true;
    }

    const subEvents: any[] = Array.isArray(st?.performance?.substitutionEvents)
      ? st.performance.substitutionEvents
      : [];
    const subTime = Number(subEvents[0]?.time);
    const subMinute = Number.isFinite(subTime) && subTime > 0 ? subTime : undefined;
    const isManOfTheMatch = Boolean(potmId && String(st?.id ?? '') === potmId);

    return {
      number: num,
      name: { en: name, fa: name },
      photoUrl: fotmobPlayerPhotoUrl(st?.id),
      position: pos,
      rating,
      x,
      y,
      ...(goals > 0 ? { goals } : {}),
      ...(assists > 0 ? { assists } : {}),
      ...(yellowCard ? { yellowCard: true } : {}),
      ...(redCard ? { redCard: true } : {}),
      ...(subMinute ? { subMinute } : {}),
      ...(isManOfTheMatch ? { isManOfTheMatch: true } : {}),
    };
  });
}

export async function getPastMatchDetail(matchId: string): Promise<Match | null> {
  const parsed = parseArchiveMatchId(matchId);
  if (!parsed) return null;

  const { leagueId, fotmobMatchId } = parsed;
  const cfg = ARCHIVE_LEAGUE_MAP.get(leagueId);
  if (!cfg) return null;

  return cachedPastFetch(`past:detail:${leagueId}:${fotmobMatchId}`, 30 * 60 * 1000, async () => {
    const md = await fetchFotmobJson<any>(`/api/data/matchDetails?matchId=${fotmobMatchId}`);
    if (!md) return null;

    const headerTeams: any[] = Array.isArray(md.header?.teams) ? md.header.teams : [];
    const homeRaw = headerTeams[0] ?? md.general?.homeTeam;
    const awayRaw = headerTeams[1] ?? md.general?.awayTeam;
    if (!homeRaw?.id || !awayRaw?.id) return null;

    const homeTeamId = makeArchiveTeamId(leagueId, homeRaw.id);
    const awayTeamId = makeArchiveTeamId(leagueId, awayRaw.id);

    const headerStatus = md.header?.status ?? {};
    const homeScore = Number.isFinite(Number(homeRaw.score)) ? Number(homeRaw.score) : 0;
    const awayScore = Number.isFinite(Number(awayRaw.score)) ? Number(awayRaw.score) : 0;
    const utcIso = String(headerStatus.utcTime ?? md.general?.matchTimeUTCDate ?? '');
    const matchDate = utcIso.length >= 10 ? utcIso.slice(0, 10) : undefined;

    const roundStr = md.general?.matchRound ?? md.general?.leagueRoundName ?? '';
    const roundLabel: LocalizedText = roundStr
      ? { en: `Matchweek ${roundStr}`, fa: `هفته ${roundStr}` }
      : cfg.name;

    // 1. Events timeline
    const rawEvents: any[] = md.content?.matchFacts?.events?.events ?? [];
    const events: MatchEvent[] = [];
    rawEvents.forEach((ev, idx) => {
      const rawType = String(ev?.type ?? '').toLowerCase();
      const timeNum = Number(ev?.time);
      if (!Number.isFinite(timeNum) || timeNum < 1) return;

      let type: MatchEvent['type'] | null = null;
      if (rawType === 'goal') type = 'goal';
      else if (rawType === 'card') {
        const cardStr = String(ev?.card ?? '').toLowerCase();
        type = cardStr.includes('red') ? 'red' : 'yellow';
      } else if (rawType === 'substitution') type = 'sub';
      else if (rawType.includes('var')) type = 'var';
      if (!type) return;

      const teamSide: 'home' | 'away' = ev?.isHome ? 'home' : 'away';
      const playerName = String(
        ev?.player?.name ?? ev?.swap?.[0]?.name ?? ev?.fullName ?? 'Player'
      ).trim();
      const assistName = ev?.assistStr ? String(ev.assistStr).trim() : '';
      const subOutName = type === 'sub' && ev?.swap?.[1]?.name ? String(ev.swap[1].name).trim() : '';
      const addedTime =
        Number.isFinite(Number(ev?.overloadTime)) && Number(ev.overloadTime) > 0
          ? Number(ev.overloadTime)
          : undefined;

      const detail: LocalizedText =
        type === 'goal'
          ? assistName
            ? { en: assistName, fa: assistName }
            : ev?.isOwnGoal
              ? { en: 'Own Goal', fa: 'گل به خودی' }
              : { en: 'Goal', fa: 'گل' }
          : type === 'red'
            ? { en: 'Red Card', fa: 'کارت قرمز' }
            : type === 'yellow'
              ? { en: 'Yellow Card', fa: 'کارت زرد' }
              : type === 'sub'
                ? subOutName
                  ? { en: `On for ${subOutName}`, fa: `جایگزین ${subOutName}` }
                  : { en: 'Substitution', fa: 'تعویض' }
                : { en: 'VAR Review', fa: 'بررسی VAR' };

      events.push({
        id: `fm-ev-${idx}-${timeNum}-${teamSide}`,
        minute: timeNum,
        addedTime,
        teamSide,
        type,
        playerName: { en: playerName, fa: playerName },
        assistOrDetail: detail,
      });
    });

    // 2. Full official statistics + xG + extra stats
    const stats = buildEmptyStats();
    let hasDetailedStats = false;
    let hasXg = false;
    const extraStatsMap = new Map<string, ExtraMatchStat>();

    const allStatGroups: any[] = md.content?.stats?.Periods?.All?.stats ?? [];
    for (const grp of allStatGroups) {
      for (const s of grp?.stats ?? []) {
        if (!Array.isArray(s?.stats) || s.stats.length < 2) continue;
        const key = String(s.key ?? '').toLowerCase();
        const hVal = parseStatNumber(s.stats[0]);
        const aVal = parseStatNumber(s.stats[1]);
        if (hVal === null || aVal === null) continue;

        if (key === 'ballpossesaion' || key === 'ballpossesion' || key === 'ballpossession') {
          stats.possession = [Math.round(hVal), Math.round(aVal)];
          hasDetailedStats = true;
        } else if (key === 'expected_goals') {
          stats.xG = [Number(hVal.toFixed(2)), Number(aVal.toFixed(2))];
          hasXg = true;
          hasDetailedStats = true;
        } else if (key === 'total_shots') {
          stats.totalShots = [Math.round(hVal), Math.round(aVal)];
          hasDetailedStats = true;
        } else if (key === 'shotsontarget') {
          stats.shotsOnTarget = [Math.round(hVal), Math.round(aVal)];
          hasDetailedStats = true;
        } else if (key === 'big_chance') {
          stats.bigChances = [Math.round(hVal), Math.round(aVal)];
          hasDetailedStats = true;
        } else if (key === 'accurate_passes') {
          stats.passAccuracy = [Math.round(hVal), Math.round(aVal)];
          hasDetailedStats = true;
        } else if (key === 'corners') {
          stats.corners = [Math.round(hVal), Math.round(aVal)];
          hasDetailedStats = true;
        } else if (key === 'matchstats.headers.tackles' || key === 'tackles') {
          stats.tackles = [Math.round(hVal), Math.round(aVal)];
          hasDetailedStats = true;
        } else if (key === 'fouls') {
          stats.fouls = [Math.round(hVal), Math.round(aVal)];
          hasDetailedStats = true;
        } else if (key === 'passes' && !extraStatsMap.has('passes')) {
          const hp = parseStatLeadingCount(s.stats[0]);
          const ap = parseStatLeadingCount(s.stats[1]);
          if (hp !== null && ap !== null) {
            extraStatsMap.set('passes', {
              label: { en: 'Total Passes', fa: 'مجموع پاس‌ها' },
              home: Math.round(hp),
              away: Math.round(ap),
            });
          }
        } else if (key === 'touches_opp_box' && !extraStatsMap.has('touches_opp_box')) {
          extraStatsMap.set('touches_opp_box', {
            label: { en: 'Touches in Opp. Box', fa: 'لمس توپ در محوطه حریف' },
            home: Math.round(hVal),
            away: Math.round(aVal),
          });
        } else if (key === 'keeper_saves' && !extraStatsMap.has('keeper_saves')) {
          extraStatsMap.set('keeper_saves', {
            label: { en: 'Goalkeeper Saves', fa: 'مهار دروازه‌بان' },
            home: Math.round(hVal),
            away: Math.round(aVal),
          });
        } else if (key === 'interceptions' && !extraStatsMap.has('interceptions')) {
          extraStatsMap.set('interceptions', {
            label: { en: 'Interceptions', fa: 'قطع توپ' },
            home: Math.round(hVal),
            away: Math.round(aVal),
          });
        } else if (key === 'clearances' && !extraStatsMap.has('clearances')) {
          extraStatsMap.set('clearances', {
            label: { en: 'Clearances', fa: 'دفع توپ' },
            home: Math.round(hVal),
            away: Math.round(aVal),
          });
        } else if (key === 'duel_won' && !extraStatsMap.has('duel_won')) {
          extraStatsMap.set('duel_won', {
            label: { en: 'Duels Won', fa: 'نبردهای موفق' },
            home: Math.round(hVal),
            away: Math.round(aVal),
          });
        } else if (key === 'offsides' && !extraStatsMap.has('offsides')) {
          extraStatsMap.set('offsides', {
            label: { en: 'Offsides', fa: 'آفساید' },
            home: Math.round(hVal),
            away: Math.round(aVal),
          });
        } else if (key === 'yellow_cards' && !extraStatsMap.has('yellow_cards')) {
          extraStatsMap.set('yellow_cards', {
            label: { en: 'Yellow Cards', fa: 'کارت زرد' },
            home: Math.round(hVal),
            away: Math.round(aVal),
          });
        }
      }
    }

    // 3. Player of the Match
    const rawPotm = md.content?.matchFacts?.playerOfTheMatch;
    const potmId = rawPotm?.id ? String(rawPotm.id) : null;
    const potmRating = Number.parseFloat(String(rawPotm?.rating?.num ?? '0'));
    let playerOfTheMatch: PlayerOfTheMatch | undefined;
    if (rawPotm?.name?.fullName && Number.isFinite(potmRating) && potmRating > 0) {
      const potmName = String(rawPotm.name.fullName).trim();
      const potmTeamId = String(rawPotm.teamId ?? '');
      const teamSide: 'home' | 'away' | undefined =
        potmTeamId === String(homeRaw.id)
          ? 'home'
          : potmTeamId === String(awayRaw.id)
            ? 'away'
            : undefined;
      playerOfTheMatch = {
        name: { en: potmName, fa: potmName },
        photoUrl: fotmobPlayerPhotoUrl(rawPotm.id),
        rating: Number(potmRating.toFixed(1)),
        teamSide,
      };
    }

    // 4. Starting XI + Substitutes with official player ratings & photos
    const homeLineup = md.content?.lineup?.homeTeam;
    const awayLineup = md.content?.lineup?.awayTeam;
    const homeFormation = String(homeLineup?.formation ?? '—').trim() || '—';
    const awayFormation = String(awayLineup?.formation ?? '—').trim() || '—';

    const homeXI = Array.isArray(homeLineup?.starters)
      ? mapFotmobLineupPlayers(homeLineup.starters.slice(0, 11), true, potmId)
      : [];
    const awayXI = Array.isArray(awayLineup?.starters)
      ? mapFotmobLineupPlayers(awayLineup.starters.slice(0, 11), true, potmId)
      : [];

    const homeSubs = Array.isArray(homeLineup?.subs)
      ? mapFotmobLineupPlayers(homeLineup.subs, false, potmId)
      : [];
    const awaySubs = Array.isArray(awayLineup?.subs)
      ? mapFotmobLineupPlayers(awayLineup.subs, false, potmId)
      : [];

    // 5. Real Attack Momentum
    const rawMom: any[] = Array.isArray(md.content?.momentum?.main?.data)
      ? md.content.momentum.main.data
      : [];
    const momentum: MomentumPoint[] = rawMom
      .filter((pt) => Number.isFinite(Number(pt?.minute)) && Number.isFinite(Number(pt?.value)))
      .filter((_, idx) => idx % 2 === 0 || idx === rawMom.length - 1)
      .map((pt) => {
        const val = Number(pt.value);
        return {
          minute: Number(pt.minute),
          homePressure: val > 0 ? Math.min(100, Math.round(val)) : 0,
          awayPressure: val < 0 ? Math.max(-100, Math.round(val)) : 0,
          homeXg: 0,
          awayXg: 0,
        };
      });

    // 6. Real Head-to-Head
    const h2hSummary: any[] = Array.isArray(md.content?.h2h?.summary) ? md.content.h2h.summary : [];
    const h2hMatches: any[] = Array.isArray(md.content?.h2h?.matches) ? md.content.h2h.matches : [];
    const recentMeetings = h2hMatches
      .filter((m) => m?.status?.finished && m?.status?.scoreStr)
      .slice(0, 6)
      .map((m) => ({
        date: String(m?.time?.utcTime ?? '').slice(0, 10),
        homeShort: deriveShortName(String(m?.home?.name ?? 'HOM')),
        awayShort: deriveShortName(String(m?.away?.name ?? 'AWY')),
        score: String(m?.status?.scoreStr ?? '-'),
        competition: String(m?.league?.name ?? cfg.name.en),
      }));

    // 7. Venue, Referee, Attendance
    const infoBox = md.content?.matchFacts?.infoBox ?? {};
    const venueName = String(infoBox.Stadium?.name ?? `${homeRaw.name ?? 'Home'} Stadium`).trim();
    const refereeName = String(infoBox.Referee?.text ?? 'Official Match Referee').trim();
    const attendanceNum = Number(infoBox.Attendance);
    const attendance = Number.isFinite(attendanceNum) && attendanceNum > 0 ? attendanceNum : undefined;

    const winProbability =
      homeScore > awayScore
        ? { home: 100, draw: 0, away: 0 }
        : awayScore > homeScore
          ? { home: 0, draw: 0, away: 100 }
          : { home: 0, draw: 100, away: 0 };

    return {
      id: matchId,
      leagueId,
      dayOffset: -1,
      matchDate,
      kickoffTime: formatUtcKickoff(utcIso),
      status: 'FT',
      venue: { en: venueName, fa: venueName },
      referee: { en: refereeName, fa: refereeName },
      ...(attendance ? { attendance } : {}),
      round: roundLabel,
      homeTeamId,
      awayTeamId,
      homeScore,
      awayScore,
      isFeatured: false,
      hasXg,
      hasDetailedStats,
      ...(playerOfTheMatch ? { playerOfTheMatch } : {}),
      winProbability,
      stats,
      extraStats: Array.from(extraStatsMap.values()),
      events,
      momentum,
      lineups: {
        homeFormation,
        awayFormation,
        homeXI,
        awayXI,
        ...(homeSubs.length > 0 ? { homeSubs } : {}),
        ...(awaySubs.length > 0 ? { awaySubs } : {}),
      },
      h2h: {
        homeWins: Number(h2hSummary[0]) || 0,
        draws: Number(h2hSummary[1]) || 0,
        awayWins: Number(h2hSummary[2]) || 0,
        recentMeetings,
      },
    };
  });
}

export function clearPastMatchesCache(): void {
  pastCache.clear();
}
