import { ALLOWED_PROVIDER_HOSTS } from '../backend/src/config/env.ts';
import type { LineupPlayer } from '../src/types/football.ts';

const FOTMOB_BASE = 'https://www.fotmob.com';
const FOTMOB_PLAYER_CDN = 'https://images.fotmob.com/image_resources/playerimages';

// Fast static lookup of major world clubs -> FotMob team IDs (saves extra search subrequests on Cloudflare Edge)
const KNOWN_FOTMOB_TEAM_IDS: Record<string, number> = {
  // Premier League
  arsenal: 9825,
  'manchester city': 8456,
  liverpool: 8650,
  chelsea: 8455,
  'manchester united': 10260,
  'tottenham hotspur': 8586,
  'aston villa': 10252,
  'newcastle united': 10261,
  'brighton & hove albion': 10204,
  'brighton and hove albion': 10204,
  brighton: 10204,
  'west ham united': 8654,
  'nottingham forest': 10203,
  fulham: 9879,
  brentford: 9937,
  'crystal palace': 9826,
  'afc bournemouth': 8678,
  bournemouth: 8678,
  everton: 8668,
  'wolverhampton wanderers': 8602,
  wolves: 8602,
  'leicester city': 8197,
  'ipswich town': 9902,
  southampton: 8466,
  'leeds united': 8463,
  burnley: 8191,
  sunderland: 8472,

  // LaLiga
  barcelona: 8634,
  'fc barcelona': 8634,
  'real madrid': 8633,
  'atletico madrid': 9906,
  'atlético madrid': 9906,
  'athletic club': 8315,
  'athletic bilbao': 8315,
  villarreal: 10205,
  'real sociedad': 8560,
  'real betis': 8603,
  sevilla: 8302,
  girona: 7732,
  valencia: 10267,
  osasuna: 8371,
  'celta vigo': 9910,
  mallorca: 8661,
  getafe: 8305,
  'rayo vallecano': 8370,

  // Serie A
  inter: 8636,
  internazionale: 8636,
  'inter milan': 8636,
  napoli: 9875,
  atalanta: 8524,
  juventus: 9885,
  'ac milan': 8564,
  milan: 8564,
  lazio: 8543,
  roma: 8686,
  'as roma': 8686,
  fiorentina: 8535,
  bologna: 9857,
  torino: 9804,
  udinese: 8600,
  como: 10171,
  genoa: 10233,

  // Bundesliga
  'bayern munich': 9823,
  'fc bayern münchen': 9823,
  'bayer leverkusen': 8178,
  'borussia dortmund': 9789,
  'rb leipzig': 178475,
  'eintracht frankfurt': 9810,
  'vfb stuttgart': 10269,
  'sc freiburg': 8358,
  'werder bremen': 8697,
  'vfl wolfsburg': 8721,
  'borussia monchengladbach': 9788,
  mainz: 9905,
  '1. fsv mainz 05': 9905,

  // Ligue 1
  'paris saint-germain': 9847,
  psg: 9847,
  'olympique de marseille': 8592,
  marseille: 8592,
  'as monaco': 9829,
  monaco: 9829,
  lille: 8639,
  'olympique lyonnais': 9748,
  lyon: 9748,
  nice: 9831,
  'ogc nice': 9831,
  lens: 8588,
  'rc lens': 8588,
  strasbourg: 9848,
  rennes: 9851,
  brest: 8521,

  // Other major UCL / ACL clubs
  'sporting cp': 9768,
  benfica: 9772,
  porto: 9773,
  psv: 8640,
  'psv eindhoven': 8640,
  feyenoord: 10235,
  ajax: 8593,
  celtic: 9925,
  'club brugge': 8342,
  galatasaray: 8637,
  fenerbahce: 8695,
  'al hilal': 2529,
  'al nassr': 101918,
  'al ahli': 2530,
  'al ittihad': 8577,
};

export interface FotmobSquadMember {
  id: number;
  name: string;
  normName: string;
  tokens: string[];
  shirtNumber: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const photoCache = new Map<string, CacheEntry<any>>();
const photoInFlight = new Map<string, Promise<any>>();

async function cachedPhotoLookup<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = photoCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const inflight = photoInFlight.get(key);
  if (inflight) return inflight as Promise<T>;

  const p = loader()
    .then((val) => {
      photoCache.set(key, { value: val, expiresAt: Date.now() + ttlMs });
      photoInFlight.delete(key);
      return val;
    })
    .catch((err) => {
      photoInFlight.delete(key);
      throw err;
    });

  photoInFlight.set(key, p);
  return p;
}

async function fetchFotmobSafe<T>(pathAndQuery: string): Promise<T | null> {
  const url = new URL(`${FOTMOB_BASE}${pathAndQuery}`);
  if (url.protocol !== 'https:' || !ALLOWED_PROVIDER_HOSTS.has(url.hostname.toLowerCase())) {
    return null;
  }
  try {
    const signal =
      typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(7000)
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

export function fotmobPlayerPhotoUrl(fotmobPlayerId: string | number | null | undefined): string | null {
  const idStr = String(fotmobPlayerId ?? '').trim();
  if (!/^\d{2,12}$/.test(idStr)) return null;
  return `${FOTMOB_PLAYER_CDN}/${idStr}.png`;
}

export function normalizePlayerName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`.-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTokens(norm: string): string[] {
  return norm.split(' ').filter((t) => t.length >= 2);
}

async function resolveFotmobTeamId(clubName: string): Promise<number | null> {
  const raw = clubName.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const norm = normalizePlayerName(raw);

  if (KNOWN_FOTMOB_TEAM_IDS[lower]) return KNOWN_FOTMOB_TEAM_IDS[lower];
  if (KNOWN_FOTMOB_TEAM_IDS[norm]) return KNOWN_FOTMOB_TEAM_IDS[norm];

  // Partial check against known keys
  for (const [k, id] of Object.entries(KNOWN_FOTMOB_TEAM_IDS)) {
    const kn = normalizePlayerName(k);
    if (kn === norm || (kn.length >= 5 && (norm.includes(kn) || kn.includes(norm)))) {
      return id;
    }
  }

  return cachedPhotoLookup(`fotmob:teamid:${norm}`, 24 * 60 * 60 * 1000, async () => {
    const res = await fetchFotmobSafe<any>(
      `/api/data/search/suggest?term=${encodeURIComponent(raw)}`
    );
    if (!Array.isArray(res)) return null;
    for (const group of res) {
      const suggestions: any[] = Array.isArray(group?.suggestions) ? group.suggestions : [];
      for (const s of suggestions) {
        if (s?.type === 'team' && /^\d+$/.test(String(s.id ?? ''))) {
          return Number(s.id);
        }
      }
    }
    return null;
  });
}

export async function fetchFotmobSquadForClub(clubName: string): Promise<FotmobSquadMember[]> {
  const teamId = await resolveFotmobTeamId(clubName);
  if (!teamId) return [];

  return cachedPhotoLookup(`fotmob:squad:${teamId}`, 6 * 60 * 60 * 1000, async () => {
    const data = await fetchFotmobSafe<any>(`/api/data/teams?id=${teamId}`);
    if (!data) return [];

    const groups: any[] = Array.isArray(data.squad?.squad)
      ? data.squad.squad
      : Array.isArray(data.squad)
        ? data.squad
        : [];

    const members: FotmobSquadMember[] = [];
    const seen = new Set<number>();

    for (const grp of groups) {
      const title = String(grp?.title ?? '').toLowerCase();
      if (title === 'coach') continue;
      const list: any[] = Array.isArray(grp?.members) ? grp.members : [];
      for (const m of list) {
        const id = Number(m?.id);
        const name = String(m?.name ?? '').trim();
        if (!Number.isFinite(id) || id <= 0 || !name || seen.has(id)) continue;
        seen.add(id);
        const normName = normalizePlayerName(name);
        const shirtNumber = Number.parseInt(String(m?.shirtNumber ?? '0'), 10) || 0;
        members.push({
          id,
          name,
          normName,
          tokens: getTokens(normName),
          shirtNumber,
        });
      }
    }
    return members;
  });
}

export function matchPlayerPhotoFromSquad(
  squad: FotmobSquadMember[],
  playerName: string,
  shirtNumber?: number
): string | null {
  if (!squad.length || !playerName.trim()) return null;

  const targetNorm = normalizePlayerName(playerName);
  const targetTokens = getTokens(targetNorm);
  const targetLast = targetTokens[targetTokens.length - 1] ?? '';
  const targetFirst = targetTokens[0] ?? '';

  // Tier 1: Exact normalized full name match
  const exact = squad.find((m) => m.normName === targetNorm);
  if (exact) return fotmobPlayerPhotoUrl(exact.id);

  // Tier 2: Exact same-club shirt number match (unique per club!)
  if (shirtNumber && shirtNumber > 0) {
    const byNumber = squad.find((m) => m.shirtNumber === shirtNumber);
    if (byNumber) return fotmobPlayerPhotoUrl(byNumber.id);
  }

  // Tier 3: Substring containment (handles mononyms like "Gabriel Magalhaes" <-> "Gabriel", "Pedri")
  if (targetNorm.length >= 4) {
    const contains = squad.find(
      (m) =>
        (m.normName.length >= 4 && targetNorm.includes(m.normName)) ||
        m.normName.includes(targetNorm)
    );
    if (contains) return fotmobPlayerPhotoUrl(contains.id);
  }

  // Tier 4: Last-name + first-initial or multi-token overlap inside the same club
  if (targetLast.length >= 3) {
    const lastCandidates = squad.filter((m) => m.tokens.includes(targetLast));
    if (lastCandidates.length === 1) {
      return fotmobPlayerPhotoUrl(lastCandidates[0].id);
    }
    if (lastCandidates.length > 1 && targetFirst) {
      const refined = lastCandidates.find((m) => m.normName.startsWith(targetFirst[0]));
      if (refined) return fotmobPlayerPhotoUrl(refined.id);
    }
  }

  // Tier 5: Any shared strong token (length >= 5, e.g., unique surname/nickname)
  for (const tok of targetTokens) {
    if (tok.length < 5) continue;
    const tokMatches = squad.filter((m) => m.tokens.includes(tok));
    if (tokMatches.length === 1) {
      return fotmobPlayerPhotoUrl(tokMatches[0].id);
    }
  }

  return null;
}

export async function searchPlayerPhotoFallback(playerName: string): Promise<string | null> {
  const clean = playerName.trim();
  const norm = normalizePlayerName(clean);
  if (norm.length < 3) return null;

  return cachedPhotoLookup(`fotmob:playersearch:${norm}`, 24 * 60 * 60 * 1000, async () => {
    const res = await fetchFotmobSafe<any>(
      `/api/data/search/suggest?term=${encodeURIComponent(clean)}`
    );
    if (!Array.isArray(res)) return null;

    const targetTokens = getTokens(norm);
    for (const group of res) {
      const suggestions: any[] = Array.isArray(group?.suggestions) ? group.suggestions : [];
      for (const s of suggestions) {
        if (s?.type !== 'player' || s?.isCoach) continue;
        const candNorm = normalizePlayerName(String(s?.name ?? ''));
        if (!candNorm) continue;
        // Require exact match or strong surname/token overlap so we never attach a wrong player's face
        const sharesToken = targetTokens.some(
          (t) => t.length >= 4 && (candNorm.includes(t) || norm.includes(candNorm))
        );
        if (candNorm === norm || sharesToken) {
          return fotmobPlayerPhotoUrl(s.id);
        }
      }
    }
    return null;
  });
}

export async function attachPhotosToLineup(
  xi: LineupPlayer[],
  clubName: string
): Promise<LineupPlayer[]> {
  if (!xi.length || !clubName.trim()) return xi;
  const squad = await fetchFotmobSquadForClub(clubName).catch(() => []);
  if (!squad.length) return xi;

  return xi.map((player) => {
    if (player.photoUrl) return player;
    const matched = matchPlayerPhotoFromSquad(squad, player.name.en, player.number);
    return matched ? { ...player, photoUrl: matched } : player;
  });
}

export function clearPlayerPhotoCache(): void {
  photoCache.clear();
}
