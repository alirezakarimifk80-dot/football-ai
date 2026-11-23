import type {
  NormalizedCoach,
  NormalizedEventCategory,
  NormalizedFixture,
  NormalizedInjury,
  NormalizedLeague,
  NormalizedLineupPlayer,
  NormalizedMatchEvent,
  NormalizedPlayerStats,
  NormalizedPrediction,
  NormalizedSquadPlayer,
  NormalizedStandingRecord,
  NormalizedStandingRow,
  NormalizedTeamLineup,
  NormalizedTeamMatchStats,
  NormalizedTeamProfile,
  NormalizedTransfer,
} from '../../types/football.ts';
import { normalizeMatchPhase, phaseToBucket, toUtcIso } from '../../utils/statusMapper.ts';

type RawObj = Record<string, any>;

function safeNum(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const cleaned = val.replace('%', '').trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function safeStr(val: unknown): string | null {
  if (typeof val === 'string' && val.trim().length > 0) return val.trim();
  return null;
}

function safeLogoUrl(val: unknown): string | null {
  const raw = safeStr(val);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
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

export function normalizeApiFootballFixture(raw: RawObj): NormalizedFixture | null {
  if (!raw || typeof raw !== 'object' || !raw.fixture?.id) return null;

  const phase = normalizeMatchPhase(raw.fixture?.status?.short);
  const bucket = phaseToBucket(phase);

  return {
    providerId: String(raw.fixture.id),
    provider: 'api-football',
    utcKickoff: toUtcIso(raw.fixture.date ?? raw.fixture.timestamp),
    phase,
    bucket,
    statusLong: safeStr(raw.fixture?.status?.long) ?? phase,
    elapsed: safeNum(raw.fixture?.status?.elapsed),
    extraTime: safeNum(raw.fixture?.status?.extra),
    venueName: safeStr(raw.fixture?.venue?.name),
    venueCity: safeStr(raw.fixture?.venue?.city),
    referee: safeStr(raw.fixture?.referee),
    league: {
      providerId: String(raw.league?.id ?? 'unknown'),
      name: safeStr(raw.league?.name) ?? 'Unknown Competition',
      country: safeStr(raw.league?.country) ?? 'International',
      logo: safeLogoUrl(raw.league?.logo),
      season: safeNum(raw.league?.season) ?? new Date().getUTCFullYear(),
      round: safeStr(raw.league?.round),
    },
    homeTeam: {
      providerId: String(raw.teams?.home?.id ?? 'home'),
      name: safeStr(raw.teams?.home?.name) ?? 'Home Team',
      logo: safeLogoUrl(raw.teams?.home?.logo),
      winner: typeof raw.teams?.home?.winner === 'boolean' ? raw.teams.home.winner : null,
    },
    awayTeam: {
      providerId: String(raw.teams?.away?.id ?? 'away'),
      name: safeStr(raw.teams?.away?.name) ?? 'Away Team',
      logo: safeLogoUrl(raw.teams?.away?.logo),
      winner: typeof raw.teams?.away?.winner === 'boolean' ? raw.teams.away.winner : null,
    },
    goals: {
      home: safeNum(raw.goals?.home),
      away: safeNum(raw.goals?.away),
    },
    score: {
      halftime: {
        home: safeNum(raw.score?.halftime?.home),
        away: safeNum(raw.score?.halftime?.away),
      },
      fulltime: {
        home: safeNum(raw.score?.fulltime?.home),
        away: safeNum(raw.score?.fulltime?.away),
      },
      extratime: {
        home: safeNum(raw.score?.extratime?.home),
        away: safeNum(raw.score?.extratime?.away),
      },
      penalty: {
        home: safeNum(raw.score?.penalty?.home),
        away: safeNum(raw.score?.penalty?.away),
      },
    },
  };
}

function classifyEventCategory(rawType: string, rawDetail: string): NormalizedEventCategory {
  const type = rawType.toLowerCase();
  const detail = rawDetail.toLowerCase();

  if (type === 'goal') {
    if (detail.includes('own goal')) return 'own_goal';
    if (detail.includes('missed penalty')) return 'missed_penalty';
    if (detail.includes('penalty')) return 'penalty';
    return 'goal';
  }
  if (type === 'card') {
    if (detail.includes('red')) return 'red_card';
    return 'yellow_card';
  }
  if (type === 'subst') return 'substitution';
  if (type === 'var') return 'var';
  return 'other';
}

export function normalizeApiFootballEvent(raw: RawObj, index: number): NormalizedMatchEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const minute = safeNum(raw.time?.elapsed);
  if (minute === null) return null;

  const extraMinute = safeNum(raw.time?.extra);
  const teamId = String(raw.team?.id ?? 'unknown');
  const rawType = safeStr(raw.type) ?? 'other';
  const rawDetail = safeStr(raw.detail) ?? '';
  const playerId = raw.player?.id ? String(raw.player.id) : null;
  const playerName = safeStr(raw.player?.name);
  const assistPlayerId = raw.assist?.id ? String(raw.assist.id) : null;
  const assistPlayerName = safeStr(raw.assist?.name);

  const eventKey = `${minute}+${extraMinute ?? 0}:${teamId}:${rawType}:${rawDetail}:${playerId ?? playerName ?? index}`;

  return {
    eventKey,
    minute,
    extraMinute,
    teamId,
    teamName: safeStr(raw.team?.name) ?? 'Unknown Team',
    teamLogo: safeLogoUrl(raw.team?.logo),
    category: classifyEventCategory(rawType, rawDetail),
    rawType,
    rawDetail,
    playerId,
    playerName,
    assistPlayerId,
    assistPlayerName,
    comments: safeStr(raw.comments),
  };
}

export function normalizeApiFootballStatistics(raw: RawObj): NormalizedTeamMatchStats | null {
  if (!raw || typeof raw !== 'object' || !raw.team?.id) return null;
  const items: RawObj[] = Array.isArray(raw.statistics) ? raw.statistics : [];

  const lookup = new Map<string, unknown>();
  for (const item of items) {
    if (item && typeof item.type === 'string') {
      lookup.set(item.type.toLowerCase(), item.value);
    }
  }

  return {
    teamId: String(raw.team.id),
    teamName: safeStr(raw.team.name) ?? 'Unknown Team',
    teamLogo: safeLogoUrl(raw.team.logo),
    possession: safeNum(lookup.get('ball possession')),
    totalShots: safeNum(lookup.get('total shots')),
    shotsOnTarget: safeNum(lookup.get('shots on goal')),
    shotsOffTarget: safeNum(lookup.get('shots off goal')),
    blockedShots: safeNum(lookup.get('blocked shots')),
    corners: safeNum(lookup.get('corner kicks')),
    fouls: safeNum(lookup.get('fouls')),
    offsides: safeNum(lookup.get('offsides')),
    yellowCards: safeNum(lookup.get('yellow cards')),
    redCards: safeNum(lookup.get('red cards')),
    saves: safeNum(lookup.get('goalkeeper saves')),
    totalPasses: safeNum(lookup.get('total passes')),
    passesAccurate: safeNum(lookup.get('passes accurate')),
    passAccuracy: safeNum(lookup.get('passes %')),
    expectedGoals: safeNum(lookup.get('expected_goals')),
  };
}

export function normalizeApiFootballLineup(raw: RawObj): NormalizedTeamLineup | null {
  if (!raw || typeof raw !== 'object' || !raw.team?.id) return null;

  const mapPlayers = (list: unknown, isStarter: boolean): NormalizedLineupPlayer[] => {
    if (!Array.isArray(list)) return [];
    return list
      .map((entry: RawObj) => {
        const p = entry?.player;
        if (!p || !safeStr(p.name)) return null;
        return {
          playerId: p.id ? String(p.id) : null,
          name: safeStr(p.name) ?? 'Unknown',
          number: safeNum(p.number),
          position: safeStr(p.pos),
          grid: safeStr(p.grid),
          isStarter,
        };
      })
      .filter((x): x is NormalizedLineupPlayer => x !== null);
  };

  return {
    teamId: String(raw.team.id),
    teamName: safeStr(raw.team.name) ?? 'Unknown Team',
    teamLogo: safeLogoUrl(raw.team.logo),
    formation: safeStr(raw.formation),
    coach: {
      providerId: raw.coach?.id ? String(raw.coach.id) : null,
      name: safeStr(raw.coach?.name),
      photo: safeLogoUrl(raw.coach?.photo),
    },
    startXI: mapPlayers(raw.startXI, true),
    substitutes: mapPlayers(raw.substitutes, false),
  };
}

export function normalizeApiFootballLeague(raw: RawObj): NormalizedLeague | null {
  if (!raw || typeof raw !== 'object' || !raw.league?.id) return null;
  const seasonsArr: RawObj[] = Array.isArray(raw.seasons) ? raw.seasons : [];
  const seasons = seasonsArr
    .map((s) => safeNum(s?.year))
    .filter((y): y is number => y !== null);
  const current = seasonsArr.find((s) => s?.current === true);

  return {
    providerId: String(raw.league.id),
    provider: 'api-football',
    name: safeStr(raw.league.name) ?? 'Unknown League',
    type: safeStr(raw.league.type) ?? 'League',
    country: safeStr(raw.country?.name) ?? 'International',
    logo: safeLogoUrl(raw.league.logo),
    seasons,
    currentSeason: safeNum(current?.year) ?? seasons[seasons.length - 1] ?? null,
  };
}

function normalizeStandingSplit(raw: RawObj | undefined): NormalizedStandingRecord {
  return {
    played: safeNum(raw?.played) ?? 0,
    won: safeNum(raw?.win) ?? 0,
    drawn: safeNum(raw?.draw) ?? 0,
    lost: safeNum(raw?.lose) ?? 0,
    goalsFor: safeNum(raw?.goals?.for) ?? 0,
    goalsAgainst: safeNum(raw?.goals?.against) ?? 0,
  };
}

export function normalizeApiFootballStandings(rawResponse: RawObj[]): NormalizedStandingRow[] {
  const firstLeague = rawResponse[0]?.league;
  const groups = firstLeague?.standings;
  if (!Array.isArray(groups) || !Array.isArray(groups[0])) return [];

  return (groups[0] as RawObj[])
    .map((row) => {
      if (!row?.team?.id) return null;
      return {
        rank: safeNum(row.rank) ?? 0,
        teamId: String(row.team.id),
        teamName: safeStr(row.team.name) ?? 'Unknown Team',
        teamLogo: safeLogoUrl(row.team.logo),
        points: safeNum(row.points) ?? 0,
        goalsDiff: safeNum(row.goalsDiff) ?? 0,
        form: safeStr(row.form),
        description: safeStr(row.description),
        all: normalizeStandingSplit(row.all),
        home: normalizeStandingSplit(row.home),
        away: normalizeStandingSplit(row.away),
      };
    })
    .filter((x): x is NormalizedStandingRow => x !== null);
}

export function normalizeApiFootballTeamProfile(raw: RawObj): NormalizedTeamProfile | null {
  if (!raw || typeof raw !== 'object' || !raw.team?.id) return null;
  return {
    providerId: String(raw.team.id),
    provider: 'api-football',
    name: safeStr(raw.team.name) ?? 'Unknown Team',
    code: safeStr(raw.team.code),
    country: safeStr(raw.team.country),
    founded: safeNum(raw.team.founded),
    logo: safeLogoUrl(raw.team.logo),
    venue: {
      name: safeStr(raw.venue?.name),
      city: safeStr(raw.venue?.city),
      capacity: safeNum(raw.venue?.capacity),
    },
  };
}

export function normalizeApiFootballSquad(rawResponse: RawObj[]): NormalizedSquadPlayer[] {
  const players = rawResponse[0]?.players;
  if (!Array.isArray(players)) return [];
  return (players as RawObj[])
    .map((p) => {
      if (!p?.id || !safeStr(p.name)) return null;
      return {
        playerId: String(p.id),
        name: safeStr(p.name) ?? 'Unknown',
        age: safeNum(p.age),
        number: safeNum(p.number),
        position: safeStr(p.position),
        photo: safeLogoUrl(p.photo),
      };
    })
    .filter((x): x is NormalizedSquadPlayer => x !== null);
}

export function normalizeApiFootballPlayer(raw: RawObj): NormalizedPlayerStats | null {
  if (!raw || typeof raw !== 'object' || !raw.player?.id) return null;
  const stat: RawObj = Array.isArray(raw.statistics) ? raw.statistics[0] ?? {} : {};

  return {
    playerId: String(raw.player.id),
    provider: 'api-football',
    name: safeStr(raw.player.name) ?? 'Unknown Player',
    age: safeNum(raw.player.age),
    nationality: safeStr(raw.player.nationality),
    photo: safeLogoUrl(raw.player.photo),
    injured: typeof raw.player.injured === 'boolean' ? raw.player.injured : null,
    teamId: stat.team?.id ? String(stat.team.id) : null,
    teamName: safeStr(stat.team?.name),
    teamLogo: safeLogoUrl(stat.team?.logo),
    leagueName: safeStr(stat.league?.name),
    position: safeStr(stat.games?.position),
    appearances: safeNum(stat.games?.appearences),
    minutes: safeNum(stat.games?.minutes),
    rating: safeNum(stat.games?.rating),
    goals: safeNum(stat.goals?.total),
    assists: safeNum(stat.goals?.assists),
    yellowCards: safeNum(stat.cards?.yellow),
    redCards: safeNum(stat.cards?.red),
    shotsTotal: safeNum(stat.shots?.total),
    shotsOn: safeNum(stat.shots?.on),
    keyPasses: safeNum(stat.passes?.key),
    passAccuracy: safeNum(stat.passes?.accuracy),
  };
}

export function normalizeApiFootballCoach(raw: RawObj): NormalizedCoach | null {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  return {
    providerId: String(raw.id),
    name: safeStr(raw.name) ?? 'Unknown Coach',
    nationality: safeStr(raw.nationality),
    age: safeNum(raw.age),
    photo: safeLogoUrl(raw.photo),
    teamId: raw.team?.id ? String(raw.team.id) : null,
    teamName: safeStr(raw.team?.name),
    teamLogo: safeLogoUrl(raw.team?.logo),
  };
}

export function normalizeApiFootballTransfers(rawResponse: RawObj[]): NormalizedTransfer[] {
  const results: NormalizedTransfer[] = [];
  for (const entry of rawResponse) {
    const playerId = entry?.player?.id ? String(entry.player.id) : null;
    const playerName = safeStr(entry?.player?.name) ?? 'Unknown Player';
    const transfers: RawObj[] = Array.isArray(entry?.transfers) ? entry.transfers : [];
    for (const tr of transfers.slice(0, 5)) {
      results.push({
        playerId,
        playerName,
        date: safeStr(tr?.date),
        type: safeStr(tr?.type),
        fromTeam: safeStr(tr?.teams?.out?.name),
        fromTeamLogo: safeLogoUrl(tr?.teams?.out?.logo),
        toTeam: safeStr(tr?.teams?.in?.name),
        toTeamLogo: safeLogoUrl(tr?.teams?.in?.logo),
      });
    }
  }
  return results;
}

export function normalizeApiFootballInjury(raw: RawObj): NormalizedInjury | null {
  if (!raw || typeof raw !== 'object' || !raw.player?.name) return null;
  return {
    playerId: raw.player?.id ? String(raw.player.id) : null,
    playerName: safeStr(raw.player.name) ?? 'Unknown Player',
    teamId: raw.team?.id ? String(raw.team.id) : null,
    teamName: safeStr(raw.team?.name),
    teamLogo: safeLogoUrl(raw.team?.logo),
    type: safeStr(raw.player?.type),
    reason: safeStr(raw.player?.reason),
    fixtureId: raw.fixture?.id ? String(raw.fixture.id) : null,
    utcDate: raw.fixture?.date ? toUtcIso(raw.fixture.date) : null,
  };
}

export function normalizeApiFootballPrediction(raw: RawObj, fixtureId: string): NormalizedPrediction | null {
  if (!raw || typeof raw !== 'object' || !raw.predictions) return null;
  return {
    fixtureId,
    winnerTeamId: raw.predictions?.winner?.id ? String(raw.predictions.winner.id) : null,
    winnerName: safeStr(raw.predictions?.winner?.name),
    advice: safeStr(raw.predictions?.advice),
    percent: {
      home: safeStr(raw.predictions?.percent?.home),
      draw: safeStr(raw.predictions?.percent?.draw),
      away: safeStr(raw.predictions?.percent?.away),
    },
  };
}
