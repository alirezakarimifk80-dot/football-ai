import type { MatchBucket, NormalizedMatchPhase } from '../types/football.ts';

const LIVE_PHASES = new Set<NormalizedMatchPhase>(['1H', '2H', 'ET', 'BT', 'P']);
const FINISHED_PHASES = new Set<NormalizedMatchPhase>(['FT', 'AET', 'PEN']);
const POSTPONED_PHASES = new Set<NormalizedMatchPhase>(['PST', 'SUSP']);
const CANCELLED_PHASES = new Set<NormalizedMatchPhase>(['CANC', 'ABD']);

export function normalizeMatchPhase(rawShort: string | null | undefined): NormalizedMatchPhase {
  const code = (rawShort ?? '').trim().toUpperCase();
  switch (code) {
    case '1H':
    case 'HT':
    case '2H':
    case 'ET':
    case 'BT':
    case 'P':
    case 'FT':
    case 'AET':
    case 'PEN':
    case 'PST':
    case 'CANC':
    case 'ABD':
    case 'SUSP':
    case 'NS':
    case 'TBD':
      return code;
    case 'LIVE':
      return '1H';
    case 'INT':
      return 'SUSP';
    case 'AWD':
    case 'WO':
      return 'FT';
    default:
      return 'TBD';
  }
}

export function phaseToBucket(phase: NormalizedMatchPhase): MatchBucket {
  if (LIVE_PHASES.has(phase)) return 'LIVE';
  if (phase === 'HT') return 'HT';
  if (FINISHED_PHASES.has(phase)) return 'FT';
  if (POSTPONED_PHASES.has(phase)) return 'POSTPONED';
  if (CANCELLED_PHASES.has(phase)) return 'CANCELLED';
  return 'UPCOMING';
}

export function isMatchLivePhase(phase: NormalizedMatchPhase): boolean {
  return LIVE_PHASES.has(phase) || phase === 'HT';
}

export function toUtcIso(dateInput: string | number | null | undefined): string {
  if (dateInput === null || dateInput === undefined || dateInput === '') {
    return new Date().toISOString();
  }
  const parsed = typeof dateInput === 'number' ? new Date(dateInput * 1000) : new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}
