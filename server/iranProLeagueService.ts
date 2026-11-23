import type {
  League,
  LineupPlayer,
  LocalizedText,
  Match,
  MatchEvent,
  MatchStatus,
  Player,
  StandingRow,
  Team,
} from '../src/types/football.ts';
import { ALLOWED_PROVIDER_HOSTS } from '../backend/src/config/env.ts';
import { fotmobPlayerPhotoUrl } from './playerPhotoService.ts';

const FOTMOB_BASE = 'https://www.fotmob.com';
const PGPL_FOTMOB_ID = 523;

interface ClubMeta {
  fa: string;
  short: string;
  primary: string;
  secondary: string;
  stadium: LocalizedText;
}

const IRAN_CLUB_META: Record<string, ClubMeta> = {
  sepahan: {
    fa: 'سپاهان اصفهان',
    short: 'SEP',
    primary: '#FACC15',
    secondary: '#111827',
    stadium: { en: 'Naghsh-e-Jahan Stadium', fa: 'ورزشگاه نقش جهان' },
  },
  persepolis: {
    fa: 'پرسپولیس تهران',
    short: 'PER',
    primary: '#DC2626',
    secondary: '#FFFFFF',
    stadium: { en: 'Azadi Stadium', fa: 'ورزشگاه آزادی' },
  },
  esteghlal: {
    fa: 'استقلال تهران',
    short: 'EST',
    primary: '#2563EB',
    secondary: '#FFFFFF',
    stadium: { en: 'Azadi Stadium', fa: 'ورزشگاه آزادی' },
  },
  tractor: {
    fa: 'تراکتور تبریز',
    short: 'TRA',
    primary: '#B91C1C',
    secondary: '#FFFFFF',
    stadium: { en: 'Yadegar-e-Emam Stadium', fa: 'ورزشگاه یادگار امام تبریز' },
  },
  'foolad khuzestan': {
    fa: 'فولاد خوزستان',
    short: 'FOO',
    primary: '#EA580C',
    secondary: '#DC2626',
    stadium: { en: 'Foolad Arena', fa: 'فولاد آرنا اهواز' },
  },
  'aluminium arak': {
    fa: 'آلومینیوم اراک',
    short: 'ALU',
    primary: '#16A34A',
    secondary: '#FFFFFF',
    stadium: { en: 'Imam Khomeini Stadium', fa: 'ورزشگاه امام خمینی اراک' },
  },
  'fajr sepasi': {
    fa: 'فجر سپاسی شیراز',
    short: 'FAJ',
    primary: '#F59E0B',
    secondary: '#1E293B',
    stadium: { en: 'Hafezieh Stadium', fa: 'ورزشگاه حافظیه شیراز' },
  },
  'chadormalu ardakan sc': {
    fa: 'چادرملو اردکان',
    short: 'CHA',
    primary: '#0284C7',
    secondary: '#FFFFFF',
    stadium: { en: 'Shahid Nassiri Stadium', fa: 'ورزشگاه شهید نصیری یزد' },
  },
  'gol gohar': {
    fa: 'گل‌گهر سیرجان',
    short: 'GOL',
    primary: '#1D4ED8',
    secondary: '#93C5FD',
    stadium: { en: 'Shahid Soleimani Stadium', fa: 'ورزشگاه شهید سلیمانی سیرجان' },
  },
  'kheybar khorramabad': {
    fa: 'خیبر خرم‌آباد',
    short: 'KHE',
    primary: '#15803D',
    secondary: '#FFFFFF',
    stadium: { en: 'Takhti Stadium Khorramabad', fa: 'ورزشگاه تختی خرم‌آباد' },
  },
  paykan: {
    fa: 'پیکان تهران',
    short: 'PAY',
    primary: '#0EA5E9',
    secondary: '#FFFFFF',
    stadium: { en: 'Shahr-e Qods Stadium', fa: 'ورزشگاه شهر قدس' },
  },
  'zob ahan': {
    fa: 'ذوب‌آهن اصفهان',
    short: 'ZOB',
    primary: '#16A34A',
    secondary: '#FFFFFF',
    stadium: { en: 'Fooladshahr Stadium', fa: 'ورزشگاه فولادشهر' },
  },
  'nassaji mazandaran fc': {
    fa: 'نساجی مازندران',
    short: 'NAS',
    primary: '#DC2626',
    secondary: '#2563EB',
    stadium: { en: 'Vatani Stadium', fa: 'ورزشگاه وطنی قائمشهر' },
  },
  'sanat naft abadan': {
    fa: 'صنعت نفت آبادان',
    short: 'SNA',
    primary: '#EAB308',
    secondary: '#0F172A',
    stadium: { en: 'Takhti Stadium Abadan', fa: 'ورزشگاه تختی آبادان' },
  },
  'esteghlal khuzestan': {
    fa: 'استقلال خوزستان',
    short: 'EKH',
    primary: '#3B82F6',
    secondary: '#FFFFFF',
    stadium: { en: 'Ghadir Stadium', fa: 'ورزشگاه غدیر اهواز' },
  },
  malavan: {
    fa: 'ملوان بندرانزلی',
    short: 'MAL',
    primary: '#FFFFFF',
    secondary: '#1E3A8A',
    stadium: { en: 'Sirous Ghayeghran Stadium', fa: 'ورزشگاه سیروس قایقران انزلی' },
  },
  'shams azar qazvin': {
    fa: 'شمس‌آذر قزوین',
    short: 'SHA',
    primary: '#22C55E',
    secondary: '#0F172A',
    stadium: { en: 'Sardar Azadegan Stadium', fa: 'ورزشگاه سردار آزادگان قزوین' },
  },
  'mes shahr babak': {
    fa: 'مس شهربابک',
    short: 'MSB',
    primary: '#EA580C',
    secondary: '#111827',
    stadium: { en: 'Shohadaye Mes Stadium', fa: 'ورزشگاه شهدای مس شهربابک' },
  },
  'mes rafsanjan': {
    fa: 'مس رفسنجان',
    short: 'MES',
    primary: '#EA580C',
    secondary: '#FFFFFF',
    stadium: { en: 'Shohadaye Mes Stadium', fa: 'ورزشگاه شهدای مس رفسنجان' },
  },
  havadar: {
    fa: 'هوادار تهران',
    short: 'HAV',
    primary: '#7C3AED',
    secondary: '#FFFFFF',
    stadium: { en: 'Dastgerdi Stadium', fa: 'ورزشگاه دستگردی تهران' },
  },
  'kheibar khorramabad': {
    fa: 'خیبر خرم‌آباد',
    short: 'KHE',
    primary: '#15803D',
    secondary: '#FFFFFF',
    stadium: { en: 'Takhti Stadium Khorramabad', fa: 'ورزشگاه تختی خرم‌آباد' },
  },
};

interface CacheSlot<T> {
  value: T;
  expiresAt: number;
}

const iranCache = new Map<string, CacheSlot<any>>();
const iranInFlight = new Map<string, Promise<any>>();

async function cachedIranFetch<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = iranCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const inflight = iranInFlight.get(key);
  if (inflight) return inflight as Promise<T>;

  const p = loader()
    .then((val) => {
      iranCache.set(key, { value: val, expiresAt: Date.now() + ttlMs });
      iranInFlight.delete(key);
      return val;
    })
    .catch((err) => {
      iranInFlight.delete(key);
      throw err;
    });

  iranInFlight.set(key, p);
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

function makeIranTeamId(fotmobTeamId: string | number): string {
  return `pgpl-t-${String(fotmobTeamId)}`;
}

export function makeIranMatchId(fotmobMatchId: string | number): string {
  return `fotmob-pgpl-${String(fotmobMatchId)}`;
}

function getClubMeta(enName: string): ClubMeta {
  const key = enName.trim().toLowerCase();
  return (
    IRAN_CLUB_META[key] ?? {
      fa: enName.trim(),
      short: enName.trim().slice(0, 3).toUpperCase(),
      primary: '#22FF66',
      secondary: '#0F172A',
      stadium: { en: `${enName.trim()} Stadium`, fa: `ورزشگاه ${enName.trim()}` },
    }
  );
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

function formatUtcKickoff(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function parseScoresStr(scoreStr: unknown): [number, number] {
  if (typeof scoreStr !== 'string') return [0, 0];
  const parts = scoreStr.split('-').map((s) => Number.parseInt(s.trim(), 10));
  if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return [parts[0], parts[1]];
  }
  return [0, 0];
}

function computeWinProb(
  homeTeam: Team | undefined,
  awayTeam: Team | undefined,
  homeScore: number | null,
  awayScore: number | null,
  status: MatchStatus
) {
  if (status === 'FT' && homeScore !== null && awayScore !== null) {
    if (homeScore > awayScore) return { home: 100, draw: 0, away: 0 };
    if (awayScore > homeScore) return { home: 0, draw: 0, away: 100 };
    return { home: 0, draw: 100, away: 0 };
  }
  const hPlayed = Math.max(1, homeTeam?.seasonStats.played ?? 0);
  const aPlayed = Math.max(1, awayTeam?.seasonStats.played ?? 0);
  const hPpg = homeTeam ? homeTeam.seasonStats.points / hPlayed : 1.4;
  const aPpg = awayTeam ? awayTeam.seasonStats.points / aPlayed : 1.4;
  const hW = 1.15 + hPpg * 0.65;
  const aW = 0.95 + aPpg * 0.65;
  const dW = 0.8;
  const total = hW + dW + aW;
  const home = Math.round((hW / total) * 100);
  const away = Math.round((aW / total) * 100);
  return { home, draw: Math.max(0, 100 - home - away), away };
}

export interface IranProLeagueBundle {
  league: League;
  teams: Team[];
  standings: StandingRow[];
  matches: Match[];
  players: Player[];
}

export async function loadIranProLeagueBundle(): Promise<IranProLeagueBundle | null> {
  return cachedIranFetch('iran:pgpl:bundle', 3 * 60 * 1000, async () => {
    const lg = await fetchFotmobJson<any>(`/api/data/leagues?id=${PGPL_FOTMOB_ID}`);
    if (!lg) return null;

    const season = String(lg.details?.selectedSeason ?? '2026/2027');
    const league: League = {
      id: 'pgpl',
      code: 'PGPL',
      name: { en: 'Persian Gulf Pro League', fa: 'لیگ برتر خلیج فارس ایران' },
      country: { en: 'Iran', fa: 'ایران' },
      season,
      accentColor: '#22FF66',
      tier: 1,
      logo: `https://images.fotmob.com/image_resources/logo/leaguelogo/${PGPL_FOTMOB_ID}.png`,
    };

    const tableRows: any[] = lg.table?.[0]?.data?.table?.all ?? [];
    const teamsMap = new Map<string, Team>();
    const standings: StandingRow[] = [];

    tableRows.forEach((row, idx) => {
      if (!row?.id || !row?.name) return;
      const internalId = makeIranTeamId(row.id);
      const enName = String(row.name).trim();
      const meta = getClubMeta(enName);
      const played = Number(row.played) || 0;
      const won = Number(row.wins) || 0;
      const drawn = Number(row.draws) || 0;
      const lost = Number(row.losses) || 0;
      const [goalsFor, goalsAgainst] = parseScoresStr(row.scoresStr);
      const points = Number(row.pts) || 0;
      const goalDiff = Number.isFinite(Number(row.goalConDiff))
        ? Number(row.goalConDiff)
        : goalsFor - goalsAgainst;
      const goalsPerMatch = played > 0 ? Number((goalsFor / played).toFixed(2)) : 0;

      const logo = `https://images.fotmob.com/image_resources/logo/teamlogo/${String(row.id)}.png`;

      const teamObj: Team = {
        id: internalId,
        leagueId: 'pgpl',
        name: { en: enName, fa: meta.fa },
        shortName: meta.short,
        logo,
        crestPrimary: meta.primary,
        crestSecondary: meta.secondary,
        crestPattern: 'solid',
        stadium: meta.stadium,
        manager: { en: 'First-Team Staff', fa: 'کادر فنی تیم اول' },
        formation: '4-2-3-1',
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
      };

      teamsMap.set(internalId, teamObj);
      standings.push({
        rank: Number(row.idx) || idx + 1,
        teamId: internalId,
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
    });

    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      return b.goalsFor - a.goalsFor;
    });
    standings.forEach((r, i) => {
      r.rank = i + 1;
    });

    // Fixtures: include any LIVE/today matches, latest finished matchday (up to 9), and next upcoming matchday (up to 9)
    const allFixtures: any[] = Array.isArray(lg.fixtures?.allMatches) ? lg.fixtures.allMatches : [];
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);

    const liveOrToday: any[] = [];
    const recentFinished: any[] = [];
    const nextUpcoming: any[] = [];

    for (const fx of allFixtures) {
      if (!fx?.id || !fx?.home?.id || !fx?.away?.id) continue;
      const st = fx.status ?? {};
      const utcIso = String(st.utcTime ?? '');
      const dayKey = utcIso.slice(0, 10);
      const isOngoing = Boolean(st.ongoing) || (Boolean(st.started) && !Boolean(st.finished) && !Boolean(st.cancelled));

      if (isOngoing || dayKey === todayKey) {
        liveOrToday.push(fx);
      } else if (st.finished) {
        recentFinished.push(fx);
      } else if (!st.cancelled) {
        nextUpcoming.push(fx);
      }
    }

    recentFinished.sort((a, b) =>
      String(b.status?.utcTime ?? '').localeCompare(String(a.status?.utcTime ?? ''))
    );
    nextUpcoming.sort((a, b) =>
      String(a.status?.utcTime ?? '').localeCompare(String(b.status?.utcTime ?? ''))
    );

    const pickedFixtures = [
      ...liveOrToday,
      ...recentFinished.slice(0, 9),
      ...nextUpcoming.slice(0, 9),
    ];

    const seenMatchIds = new Set<string>();
    const matches: Match[] = [];

    for (const fx of pickedFixtures) {
      const fxId = String(fx.id);
      if (seenMatchIds.has(fxId)) continue;
      seenMatchIds.add(fxId);

      const homeId = makeIranTeamId(fx.home.id);
      const awayId = makeIranTeamId(fx.away.id);

      // Ensure both teams exist even if a promoted club wasn't in table yet
      for (const side of [
        { raw: fx.home, id: homeId },
        { raw: fx.away, id: awayId },
      ]) {
        if (!teamsMap.has(side.id)) {
          const enName = String(side.raw.name ?? 'Club').trim();
          const meta = getClubMeta(enName);
          teamsMap.set(side.id, {
            id: side.id,
            leagueId: 'pgpl',
            name: { en: enName, fa: meta.fa },
            shortName: meta.short,
            logo: `https://images.fotmob.com/image_resources/logo/teamlogo/${String(side.raw.id)}.png`,
            crestPrimary: meta.primary,
            crestSecondary: meta.secondary,
            crestPattern: 'solid',
            stadium: meta.stadium,
            manager: { en: 'First-Team Staff', fa: 'کادر فنی تیم اول' },
            formation: '4-2-3-1',
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
          });
        }
      }

      const homeTeam = teamsMap.get(homeId);
      const awayTeam = teamsMap.get(awayId);

      const st = fx.status ?? {};
      const utcIso = String(st.utcTime ?? '');
      const dayKey = utcIso.slice(0, 10);

      let status: MatchStatus = 'UPCOMING';
      let minute: number | undefined;
      if (st.finished) {
        status = 'FT';
      } else if (st.ongoing || (st.started && !st.finished && !st.cancelled)) {
        const liveStr = String(st.liveTime?.short ?? '');
        if (liveStr.toUpperCase() === 'HT') {
          status = 'HT';
          minute = 45;
        } else {
          status = 'LIVE';
          const m = liveStr.match(/(\d+)/);
          minute = m ? Number.parseInt(m[1], 10) : 1;
        }
      }

      let homeScore: number | null = null;
      let awayScore: number | null = null;
      if (status !== 'UPCOMING') {
        const [hs, as] = parseScoresStr(st.scoreStr);
        homeScore = hs;
        awayScore = as;
      }

      let dayOffset = 0;
      if (status === 'LIVE' || status === 'HT' || dayKey === todayKey) {
        dayOffset = 0;
      } else if (status === 'FT' || dayKey < todayKey) {
        dayOffset = -1;
      } else {
        dayOffset = 1;
      }

      const roundNum = fx.roundName ?? fx.round ?? '';
      const roundLabel: LocalizedText = roundNum
        ? { en: `Matchweek ${roundNum}`, fa: `هفته ${roundNum}` }
        : { en: 'Persian Gulf Pro League', fa: 'لیگ برتر خلیج فارس' };

      matches.push({
        id: makeIranMatchId(fxId),
        leagueId: 'pgpl',
        dayOffset,
        matchDate: dayKey || undefined,
        kickoffTime: formatUtcKickoff(utcIso),
        status,
        minute,
        venue: homeTeam?.stadium ?? { en: 'Iran Stadium', fa: 'ورزشگاه خانگی' },
        referee: { en: 'Iran Pro League Referee', fa: 'داور لیگ برتر ایران' },
        round: roundLabel,
        homeTeamId: homeId,
        awayTeamId: awayId,
        homeScore,
        awayScore,
        isFeatured: false,
        hasXg: false,
        hasDetailedStats: false,
        winProbability: computeWinProb(homeTeam, awayTeam, homeScore, awayScore, status),
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

    // Pre-enrich the most recent/live PGPL match so MatchProgressBar shows real goals/cards immediately
    const enrichTargets = matches
      .filter((m) => m.status === 'LIVE' || m.status === 'HT' || m.status === 'FT')
      .slice(0, 1);
    if (enrichTargets.length > 0) {
      const enrichedList = await Promise.all(
        enrichTargets.map((m) => enrichIranMatchSummary(m).catch(() => m))
      );
      enrichedList.forEach((em) => {
        const idx = matches.findIndex((x) => x.id === em.id);
        if (idx !== -1) matches[idx] = em;
      });
    }

    // Real PGPL Top Players from FotMob stats (Top scorers, assists, goals/90, minutes)
    const playersMap = new Map<string, Player>();
    const statCategories: any[] = Array.isArray(lg.stats?.players) ? lg.stats.players : [];

    for (const cat of statCategories) {
      const catName = String(cat?.name ?? '').toLowerCase();
      const topList: any[] = Array.isArray(cat?.topThree) ? cat.topThree : [];
      for (const item of topList) {
        if (!item?.id || !item?.name || !item?.teamId) continue;
        const pid = `pgpl-p-${String(item.id)}`;
        const tid = makeIranTeamId(item.teamId);
        if (!teamsMap.has(tid)) continue;

        const existing = playersMap.get(pid);
        const val = Number(item.value) || 0;
        const goals = catName === 'goals' ? val : existing?.stats.goals ?? 0;
        const assists = catName === 'goal_assist' || catName === 'assists' ? val : existing?.stats.assists ?? 0;
        const apps = existing?.stats.appearances ?? Math.max(1, teamsMap.get(tid)?.seasonStats.played ?? 10);
        const computedRating = Number(
          Math.min(8.6, 6.75 + goals * 0.14 + assists * 0.11).toFixed(2)
        );

        const pName = String(item.name).trim();
        playersMap.set(pid, {
          id: pid,
          teamId: tid,
          name: { en: pName, fa: pName },
          photoUrl: fotmobPlayerPhotoUrl(item.id),
          nationality: { en: 'Iran', fa: 'ایران' },
          position: catName === 'goals' || catName === 'goals_per_90' ? 'FWD' : 'MID',
          age: 26,
          shirtNumber: 0,
          preferredFoot: 'Right',
          marketValueEurM: 0,
          rating: computedRating,
          stats: {
            appearances: apps,
            goals,
            assists,
            xG: 0,
            xA: 0,
            passAccuracy: 0,
            keyPassesPer90: 0,
            shotsPer90: 0,
            tacklesPer90: 0,
          },
          radar: {
            pace: Math.min(92, 68 + goals * 2),
            shooting: Math.min(94, 62 + goals * 4),
            passing: Math.min(90, 68 + assists * 4),
            dribbling: Math.min(90, 70 + goals * 2),
            defending: 48,
            physical: 74,
          },
          recentRatings: [],
        });
      }
    }

    return {
      league,
      teams: Array.from(teamsMap.values()),
      standings,
      matches,
      players: Array.from(playersMap.values()).sort((a, b) => b.stats.goals - a.stats.goals),
    };
  });
}

export async function enrichIranMatchSummary(baseMatch: Match): Promise<Match> {
  if (!baseMatch.id.startsWith('fotmob-pgpl-')) return baseMatch;
  const rawMatchId = baseMatch.id.replace('fotmob-pgpl-', '');
  if (!/^\d{4,16}$/.test(rawMatchId)) return baseMatch;

  const ttlMs =
    baseMatch.status === 'LIVE' || baseMatch.status === 'HT' ? 30 * 1000 : 10 * 60 * 1000;

  return cachedIranFetch(`iran:pgpl:detail:${rawMatchId}`, ttlMs, async () => {
    const md = await fetchFotmobJson<any>(`/api/data/matchDetails?matchId=${rawMatchId}`);
    if (!md) return baseMatch;

    const headerStatus = md.header?.status ?? {};
    let status: MatchStatus = baseMatch.status;
    let minute = baseMatch.minute;

    if (headerStatus.finished) {
      status = 'FT';
      minute = undefined;
    } else if (headerStatus.ongoing || (headerStatus.started && !headerStatus.finished)) {
      const liveShort = String(headerStatus.liveTime?.short ?? '');
      if (liveShort.toUpperCase() === 'HT') {
        status = 'HT';
        minute = 45;
      } else {
        status = 'LIVE';
        const m = liveShort.match(/(\d+)/);
        minute = m ? Number.parseInt(m[1], 10) : baseMatch.minute ?? 1;
      }
    }

    const headerTeams: any[] = Array.isArray(md.header?.teams) ? md.header.teams : [];
    const homeScore =
      status === 'UPCOMING'
        ? null
        : Number.isFinite(Number(headerTeams[0]?.score))
          ? Number(headerTeams[0].score)
          : baseMatch.homeScore;
    const awayScore =
      status === 'UPCOMING'
        ? null
        : Number.isFinite(Number(headerTeams[1]?.score))
          ? Number(headerTeams[1].score)
          : baseMatch.awayScore;

    // Parse real events (Goals, Yellow/Red cards, Substitutions, VAR)
    const rawEvents: any[] = md.content?.matchFacts?.events?.events ?? [];
    const parsedEvents: MatchEvent[] = [];

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
      const addedTime = Number.isFinite(Number(ev?.overloadTime)) && Number(ev.overloadTime) > 0
        ? Number(ev.overloadTime)
        : undefined;

      const detail: LocalizedText | undefined =
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
                ? { en: 'Substitution', fa: 'تعویض' }
                : { en: 'VAR Review', fa: 'بررسی VAR' };

      parsedEvents.push({
        id: `pgpl-ev-${idx}-${timeNum}-${teamSide}`,
        minute: timeNum,
        addedTime,
        teamSide,
        type,
        playerName: { en: playerName, fa: playerName },
        assistOrDetail: detail,
      });
    });

    // Optional real stats if available from FotMob
    const stats = buildEmptyStats();
    let hasDetailedStats = false;
    const allStatGroups: any[] = md.content?.stats?.Periods?.All?.stats ?? [];
    for (const grp of allStatGroups) {
      for (const s of grp?.stats ?? []) {
        if (!Array.isArray(s?.stats) || s.stats.length < 2) continue;
        const h = Number.parseFloat(String(s.stats[0]).replace('%', ''));
        const a = Number.parseFloat(String(s.stats[1]).replace('%', ''));
        if (!Number.isFinite(h) || !Number.isFinite(a)) continue;
        const key = String(s.key ?? '').toLowerCase();
        if (key === 'ballpossesaion' || key === 'ballpossession' || key.includes('possession')) {
          stats.possession = [Math.round(h), Math.round(a)];
          hasDetailedStats = true;
        } else if (key === 'total_shots') {
          stats.totalShots = [Math.round(h), Math.round(a)];
          hasDetailedStats = true;
        } else if (key === 'shotsontarget') {
          stats.shotsOnTarget = [Math.round(h), Math.round(a)];
          hasDetailedStats = true;
        } else if (key === 'corners') {
          stats.corners = [Math.round(h), Math.round(a)];
          hasDetailedStats = true;
        } else if (key === 'fouls') {
          stats.fouls = [Math.round(h), Math.round(a)];
          hasDetailedStats = true;
        }
      }
    }

    const venueName = String(
      md.content?.matchFacts?.infoBox?.Stadium?.name ?? baseMatch.venue.en
    ).trim();
    const refereeName = String(
      md.content?.matchFacts?.infoBox?.Referee?.text ?? baseMatch.referee.en
    ).trim();

    // Extract FotMob starting XI lineups with official player portraits when available
    const mapFotmobSideLineup = (sideLineup: any): { formation: string; xi: LineupPlayer[] } => {
      const formation = String(sideLineup?.formation ?? '—').trim() || '—';
      const starters: any[] = Array.isArray(sideLineup?.starters) ? sideLineup.starters : [];
      if (starters.length === 0) return { formation, xi: [] };

      const xi: LineupPlayer[] = starters.slice(0, 11).map((st, idx) => {
        const name = String(st?.name ?? 'Player').trim();
        const num = Number.parseInt(String(st?.shirtNumber ?? '0'), 10) || 0;
        const rawRating = Number(st?.performance?.rating ?? 0);
        const rating = Number.isFinite(rawRating) && rawRating > 0 ? Number(rawRating.toFixed(1)) : 0;
        const pos = String(st?.usualPlayingPositionId === 0 ? 'GK' : st?.position ?? (idx === 0 ? 'GK' : 'MID'));
        // FotMob horizontalLayout gives x/y in [0..1] when present
        const lx = Number(st?.horizontalLayout?.y);
        const ly = Number(st?.horizontalLayout?.x);
        const x = Number.isFinite(lx) ? Math.round(12 + lx * 76) : idx === 0 ? 50 : 20 + ((idx * 17) % 64);
        const y = Number.isFinite(ly) ? Math.round(12 + ly * 76) : idx === 0 ? 11 : Math.min(86, 28 + Math.floor((idx - 1) / 3) * 20);
        return {
          number: num,
          name: { en: name, fa: name },
          photoUrl: fotmobPlayerPhotoUrl(st?.id),
          position: pos,
          rating,
          x,
          y,
        };
      });

      return { formation, xi };
    };

    const homeLineupParsed = mapFotmobSideLineup(md.content?.lineup?.homeTeam);
    const awayLineupParsed = mapFotmobSideLineup(md.content?.lineup?.awayTeam);

    return {
      ...baseMatch,
      status,
      minute,
      homeScore,
      awayScore,
      venue: venueName !== baseMatch.venue.en ? { en: venueName, fa: venueName } : baseMatch.venue,
      referee:
        refereeName !== baseMatch.referee.en
          ? { en: refereeName, fa: refereeName }
          : baseMatch.referee,
      hasDetailedStats,
      stats,
      events: parsedEvents.length > 0 ? parsedEvents : baseMatch.events,
      lineups:
        homeLineupParsed.xi.length > 0 || awayLineupParsed.xi.length > 0
          ? {
              homeFormation: homeLineupParsed.formation,
              awayFormation: awayLineupParsed.formation,
              homeXI: homeLineupParsed.xi,
              awayXI: awayLineupParsed.xi,
            }
          : baseMatch.lineups,
    };
  });
}

export function clearIranProLeagueCache(): void {
  iranCache.clear();
}
