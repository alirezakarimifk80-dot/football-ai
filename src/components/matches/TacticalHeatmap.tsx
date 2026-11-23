import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flame, Grid3X3, MapPin } from 'lucide-react';
import type { LineupPlayer, Match, MatchEvent, Team } from '../../types/football';
import { useLanguage } from '../../i18n/LanguageContext';

interface TacticalHeatmapProps {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
}

type TeamFilter = 'both' | 'home' | 'away';
type HalfFilter = 'all' | 'first' | 'second';

interface HeatSample {
  x: number; // 0..100 (Home defends left x=0, attacks right x=100)
  y: number; // 0..100 (top touchline y=0, bottom touchline y=100)
  weight: number;
  side: 'home' | 'away';
}

interface PositionedEvent {
  event: MatchEvent;
  x: number;
  y: number;
  assistX?: number;
  assistY?: number;
  zoneEn: string;
  zoneFa: string;
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function findLineupMatch(playerName: string, xi: LineupPlayer[]): LineupPlayer | undefined {
  const target = normalizeName(playerName);
  if (!target) return undefined;
  const targetParts = target.split(/\s+/).filter(Boolean);
  const lastName = targetParts[targetParts.length - 1] ?? '';

  return xi.find((p) => {
    const candidate = normalizeName(p.name.en);
    if (!candidate) return false;
    if (candidate === target) return true;
    if (lastName.length >= 3 && candidate.includes(lastName)) return true;
    return false;
  });
}

function inferRoleDepthY(position: string | undefined): { attackDepth: number; lateralY: number } | null {
  if (!position) return null;
  const pos = position.toUpperCase();
  if (pos.includes('GK') || pos === 'G') return { attackDepth: 12, lateralY: 50 };
  if (pos.includes('LB') || pos.includes('LWB')) return { attackDepth: 42, lateralY: 18 };
  if (pos.includes('RB') || pos.includes('RWB')) return { attackDepth: 42, lateralY: 82 };
  if (pos.includes('CB') || pos === 'D' || pos === 'DEF') return { attackDepth: 30, lateralY: 50 };
  if (pos.includes('LW') || pos.includes('LM')) return { attackDepth: 72, lateralY: 20 };
  if (pos.includes('RW') || pos.includes('RM')) return { attackDepth: 72, lateralY: 80 };
  if (pos.includes('CAM') || pos.includes('AM')) return { attackDepth: 70, lateralY: 50 };
  if (pos.includes('CDM') || pos.includes('DM')) return { attackDepth: 46, lateralY: 50 };
  if (pos.includes('CM') || pos === 'M' || pos === 'MID') return { attackDepth: 56, lateralY: 50 };
  if (pos.includes('ST') || pos.includes('CF') || pos === 'F' || pos === 'FWD') {
    return { attackDepth: 82, lateralY: 50 };
  }
  return null;
}

function describePitchZone(
  x: number,
  y: number,
  side: 'home' | 'away'
): { zoneEn: string; zoneFa: string } {
  // Attacking-relative depth: 0 = own goal line, 100 = opponent goal line
  const attX = side === 'home' ? x : 100 - x;
  const isBox = attX >= 83 && y >= 22 && y <= 78;
  if (isBox) {
    return { zoneEn: 'Opponent Penalty Area', zoneFa: 'محوطه جریمه حریف' };
  }

  const thirdEn = attX < 34 ? 'Defensive Third' : attX < 67 ? 'Middle Third' : 'Final Third';
  const thirdFa = attX < 34 ? 'یک‌سوم دفاعی' : attX < 67 ? 'میانه زمین' : 'یک‌سوم هجومی';

  const flankEn = y < 33 ? 'Left Channel' : y > 67 ? 'Right Channel' : 'Central Corridor';
  const flankFa = y < 33 ? 'کانال چپ' : y > 67 ? 'کانال راست' : 'محور میانی';

  return {
    zoneEn: `${thirdEn} · ${flankEn}`,
    zoneFa: `${thirdFa} · ${flankFa}`,
  };
}

function computeEventPosition(
  ev: MatchEvent,
  homeXI: LineupPlayer[],
  awayXI: LineupPlayer[]
): PositionedEvent {
  const xi = ev.teamSide === 'home' ? homeXI : awayXI;
  const matchedPlayer = findLineupMatch(ev.playerName.en, xi);
  const roleHint = inferRoleDepthY(matchedPlayer?.position);

  const r1 = hashSeed(`${ev.id}:x:${ev.minute}`);
  const r2 = hashSeed(`${ev.id}:y:${ev.playerName.en}`);
  const r3 = hashSeed(`${ev.id}:v:${ev.type}`);
  const detailLower = (ev.assistOrDetail?.en ?? '').toLowerCase();
  const isPenalty = detailLower.includes('pen');
  const isOwnGoal = detailLower.includes('own');

  // Anchor lateral coordinate using real lineup width when available
  const baseLateral = matchedPlayer
    ? clamp(matchedPlayer.x, 12, 88)
    : roleHint
      ? roleHint.lateralY
      : 20 + r2 * 60;

  let attX: number;
  let y: number;

  if (ev.type === 'goal') {
    if (isOwnGoal) {
      attX = 10 + r1 * 8;
      y = 38 + r2 * 24;
    } else if (isPenalty) {
      attX = 88.5;
      y = 50;
    } else {
      attX = 82 + r1 * 13;
      y = clamp(32 + (baseLateral - 50) * 0.42 + (r2 - 0.5) * 20, 22, 78);
    }
  } else if (ev.type === 'var') {
    attX = 76 + r1 * 16;
    y = clamp(28 + r2 * 44, 20, 80);
  } else if (ev.type === 'yellow' || ev.type === 'red') {
    const roleDepth = roleHint?.attackDepth ?? 50;
    attX = clamp(roleDepth + (r1 - 0.5) * 26, 20, 82);
    y = clamp(baseLateral + (r2 - 0.5) * 22, 10, 90);
  } else {
    // Substitution anchored near tactical zone & touchline transition
    const roleDepth = roleHint?.attackDepth ?? 52;
    attX = clamp(roleDepth * 0.6 + 20 + (r1 - 0.5) * 14, 24, 76);
    y = clamp(baseLateral * 0.55 + 40 + (r3 - 0.5) * 12, 14, 92);
  }

  const x = ev.teamSide === 'home' ? attX : 100 - attX;

  let assistX: number | undefined;
  let assistY: number | undefined;
  if (ev.type === 'goal' && !isPenalty && !isOwnGoal && ev.assistOrDetail?.en) {
    const assistAttX = clamp(attX - (10 + r3 * 12), 54, 86);
    assistX = ev.teamSide === 'home' ? assistAttX : 100 - assistAttX;
    assistY = clamp(y + (r1 > 0.5 ? 16 : -16), 12, 88);
  }

  const { zoneEn, zoneFa } = describePitchZone(x, y, ev.teamSide);
  return { event: ev, x, y, assistX, assistY, zoneEn, zoneFa };
}

function buildHeatmapSamples(
  positionedEvents: PositionedEvent[],
  match: Match,
  teamFilter: TeamFilter,
  selectedPlayerKey: string
): HeatSample[] {
  const samples: HeatSample[] = [];

  for (const item of positionedEvents) {
    const { event, x, y, assistX, assistY } = item;
    const baseWeight =
      event.type === 'goal'
        ? 1.0
        : event.type === 'red'
          ? 0.9
          : event.type === 'var'
            ? 0.85
            : event.type === 'yellow'
              ? 0.72
              : 0.48;

    // Primary event hotspot
    samples.push({ x, y, weight: baseWeight, side: event.teamSide });

    // Directional approach footprint leading into the action
    const dir = event.teamSide === 'home' ? -1 : 1;
    const s1 = hashSeed(`${event.id}:approach1`);
    const s2 = hashSeed(`${event.id}:approach2`);
    samples.push({
      x: clamp(x + dir * (7 + s1 * 7), 6, 94),
      y: clamp(y + (s2 - 0.5) * 14, 8, 92),
      weight: baseWeight * 0.62,
      side: event.teamSide,
    });
    samples.push({
      x: clamp(x + dir * (15 + s2 * 8), 6, 94),
      y: clamp(y + (s1 - 0.5) * 20, 8, 92),
      weight: baseWeight * 0.36,
      side: event.teamSide,
    });

    if (assistX !== undefined && assistY !== undefined) {
      samples.push({ x: assistX, y: assistY, weight: 0.72, side: event.teamSide });
      samples.push({
        x: (x + assistX) / 2,
        y: (y + assistY) / 2,
        weight: 0.42,
        side: event.teamSide,
      });
    }
  }

  // When viewing team-wide movement (no single player locked) and match has events,
  // blend light positional anchors from real starting XI + possession tilt so team shape is readable.
  if (selectedPlayerKey === 'all' && positionedEvents.length > 0) {
    const homePossShift = ((match.stats.possession[0] ?? 50) - 50) * 0.25;
    const addLineupFootprint = (xi: LineupPlayer[], side: 'home' | 'away') => {
      if (teamFilter !== 'both' && teamFilter !== side) return;
      const shift = side === 'home' ? homePossShift : -homePossShift;
      for (const p of xi) {
        // LineupPlayer uses y=0..100 half-pitch depth (GK near 10, FWD near 88), x=0..100 pitch width
        const attDepth = clamp(p.y * 0.84 + 6 + shift, 8, 86);
        const px = side === 'home' ? attDepth : 100 - attDepth;
        const py = clamp(p.x, 10, 90);
        samples.push({ x: px, y: py, weight: 0.22, side });
      }
    };
    addLineupFootprint(match.lineups.homeXI, 'home');
    addLineupFootprint(match.lineups.awayXI, 'away');
  }

  return samples;
}

function renderThermalCanvas(
  canvas: HTMLCanvasElement,
  samples: HeatSample[],
  paletteMode: TeamFilter
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  if (samples.length === 0) return;

  // Accumulate 2D Gaussian kernel density on a crisp grid buffer
  const grid = new Float32Array(width * height);
  const sigmaX = width * 0.088;
  const sigmaY = height * 0.115;
  const radiusX = Math.ceil(sigmaX * 2.6);
  const radiusY = Math.ceil(sigmaY * 2.6);
  const inv2SigX2 = 1 / (2 * sigmaX * sigmaX);
  const inv2SigY2 = 1 / (2 * sigmaY * sigmaY);

  let maxVal = 0;

  for (const s of samples) {
    const cx = (s.x / 100) * width;
    const cy = (s.y / 100) * height;
    const x0 = Math.max(0, Math.floor(cx - radiusX));
    const x1 = Math.min(width - 1, Math.ceil(cx + radiusX));
    const y0 = Math.max(0, Math.floor(cy - radiusY));
    const y1 = Math.min(height - 1, Math.ceil(cy + radiusY));

    for (let py = y0; py <= y1; py++) {
      const dy = py - cy;
      const dyTerm = dy * dy * inv2SigY2;
      const rowOffset = py * width;
      for (let px = x0; px <= x1; px++) {
        const dx = px - cx;
        const val = s.weight * Math.exp(-(dx * dx * inv2SigX2 + dyTerm));
        const next = grid[rowOffset + px] + val;
        grid[rowOffset + px] = next;
        if (next > maxVal) maxVal = next;
      }
    }
  }

  if (maxVal <= 0.0001) return;

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  // Calibrated football analytics thermal color ramps
  // Home / Both: emerald -> lime -> amber -> hot red
  // Away-only: deep cyan -> sky blue -> warm gold -> hot coral
  for (let i = 0; i < grid.length; i++) {
    const t = clamp(grid[i] / maxVal, 0, 1);
    if (t < 0.08) continue;

    const norm = (t - 0.08) / 0.92;
    let r = 0;
    let g = 0;
    let b = 0;

    if (paletteMode === 'away') {
      if (norm < 0.35) {
        const k = norm / 0.35;
        r = Math.round(14 + k * 42);
        g = Math.round(116 + k * 73);
        b = Math.round(144 + k * 104);
      } else if (norm < 0.72) {
        const k = (norm - 0.35) / 0.37;
        r = Math.round(56 + k * 194);
        g = Math.round(189 + k * 15);
        b = Math.round(248 - k * 218);
      } else {
        const k = (norm - 0.72) / 0.28;
        r = Math.round(250 - k * 11);
        g = Math.round(204 - k * 136);
        b = Math.round(30 + k * 38);
      }
    } else {
      if (norm < 0.35) {
        const k = norm / 0.35;
        r = Math.round(16 + k * 18);
        g = Math.round(135 + k * 120);
        b = Math.round(92 + k * 10);
      } else if (norm < 0.72) {
        const k = (norm - 0.35) / 0.37;
        r = Math.round(34 + k * 216);
        g = Math.round(255 - k * 66);
        b = Math.round(102 - k * 84);
      } else {
        const k = (norm - 0.72) / 0.28;
        r = Math.round(250 - k * 11);
        g = Math.round(189 - k * 121);
        b = Math.round(18 + k * 50);
      }
    }

    const alpha = Math.round(clamp(Math.pow(norm, 0.85) * 215, 0, 220));
    const idx = i * 4;
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = alpha;
  }

  ctx.putImageData(imageData, 0, 0);
}

export const TacticalHeatmap: React.FC<TacticalHeatmapProps> = ({
  match,
  homeTeam,
  awayTeam,
}) => {
  const { lang, localize } = useLanguage();
  const isFa = lang === 'fa';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [teamFilter, setTeamFilter] = useState<TeamFilter>('both');
  const [halfFilter, setHalfFilter] = useState<HalfFilter>('all');
  const [selectedPlayerKey, setSelectedPlayerKey] = useState<string>('all');
  const [showEventPins, setShowEventPins] = useState<boolean>(true);
  const [showZoneGrid, setShowZoneGrid] = useState<boolean>(true);
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);

  // Reset per-match interactive filters cleanly when switching matches
  useEffect(() => {
    setTeamFilter('both');
    setHalfFilter('all');
    setSelectedPlayerKey('all');
    setFocusedEventId(null);
  }, [match.id]);

  // All positioned events from real match data
  const allPositionedEvents = useMemo(
    () =>
      match.events
        .slice()
        .sort((a, b) => a.minute - b.minute)
        .map((ev) => computeEventPosition(ev, match.lineups.homeXI, match.lineups.awayXI)),
    [match.events, match.lineups.homeXI, match.lineups.awayXI]
  );

  // Unique players appearing in filtered team's match events for Player Focus dropdown
  const playerOptions = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; side: 'home' | 'away'; count: number }
    >();
    for (const item of allPositionedEvents) {
      if (teamFilter !== 'both' && item.event.teamSide !== teamFilter) continue;
      const key = `${item.event.teamSide}:${normalizeName(item.event.playerName.en) || item.event.playerName.en}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          key,
          label: localize(item.event.playerName),
          side: item.event.teamSide,
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [allPositionedEvents, teamFilter, localize]);

  // Keep selectedPlayerKey valid when changing teamFilter
  useEffect(() => {
    if (selectedPlayerKey !== 'all' && !playerOptions.some((p) => p.key === selectedPlayerKey)) {
      setSelectedPlayerKey('all');
    }
  }, [playerOptions, selectedPlayerKey]);

  // Active events matching Team + Half + Player filters
  const filteredEvents = useMemo(() => {
    return allPositionedEvents.filter((item) => {
      if (teamFilter !== 'both' && item.event.teamSide !== teamFilter) return false;
      if (halfFilter === 'first' && item.event.minute > 45) return false;
      if (halfFilter === 'second' && item.event.minute <= 45) return false;
      if (selectedPlayerKey !== 'all') {
        const key = `${item.event.teamSide}:${normalizeName(item.event.playerName.en) || item.event.playerName.en}`;
        if (key !== selectedPlayerKey) return false;
      }
      return true;
    });
  }, [allPositionedEvents, teamFilter, halfFilter, selectedPlayerKey]);

  const samples = useMemo(
    () => buildHeatmapSamples(filteredEvents, match, teamFilter, selectedPlayerKey),
    [filteredEvents, match, teamFilter, selectedPlayerKey]
  );

  // Render Gaussian KDE heatmap into canvas whenever filtered samples change
  useEffect(() => {
    if (!canvasRef.current) return;
    renderThermalCanvas(canvasRef.current, samples, teamFilter);
  }, [samples, teamFilter]);

  // Channel & Third zone dominance stats derived strictly from active samples
  const zoneMetrics = useMemo(() => {
    if (samples.length === 0) {
      return {
        leftPct: 0,
        centerPct: 0,
        rightPct: 0,
        defPct: 0,
        midPct: 0,
        attPct: 0,
      };
    }

    let leftW = 0;
    let centerW = 0;
    let rightW = 0;
    let defW = 0;
    let midW = 0;
    let attW = 0;
    let total = 0;

    for (const s of samples) {
      total += s.weight;
      if (s.y < 33.33) leftW += s.weight;
      else if (s.y > 66.67) rightW += s.weight;
      else centerW += s.weight;

      const attX = teamFilter === 'away' ? 100 - s.x : s.x;
      if (attX < 33.33) defW += s.weight;
      else if (attX < 66.67) midW += s.weight;
      else attW += s.weight;
    }

    const toPct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
    const leftPct = toPct(leftW);
    const rightPct = toPct(rightW);
    const centerPct = Math.max(0, 100 - leftPct - rightPct);

    const defPct = toPct(defW);
    const attPct = toPct(attW);
    const midPct = Math.max(0, 100 - defPct - attPct);

    return { leftPct, centerPct, rightPct, defPct, midPct, attPct };
  }, [samples, teamFilter]);

  const activeFocusedEvent = useMemo(() => {
    if (!focusedEventId) return filteredEvents[filteredEvents.length - 1] ?? null;
    return filteredEvents.find((item) => item.event.id === focusedEventId) ?? filteredEvents[0] ?? null;
  }, [filteredEvents, focusedEventId]);

  const homeName = localize(homeTeam.name);
  const awayName = localize(awayTeam.name);

  const eventTypeLabel = (type: MatchEvent['type']): string => {
    if (isFa) {
      switch (type) {
        case 'goal':
          return 'گل';
        case 'yellow':
          return 'کارت زرد';
        case 'red':
          return 'کارت قرمز';
        case 'sub':
          return 'تعویض';
        case 'var':
          return 'بازبینی VAR';
      }
    }
    switch (type) {
      case 'goal':
        return 'Goal';
      case 'yellow':
        return 'Yellow Card';
      case 'red':
        return 'Red Card';
      case 'sub':
        return 'Substitution';
      case 'var':
        return 'VAR Review';
    }
  };

  // Player movement trail path when a single player has >= 2 events
  const playerTrailPoints = useMemo(() => {
    if (selectedPlayerKey === 'all' || filteredEvents.length < 2) return '';
    return filteredEvents.map((item) => `${item.x.toFixed(1)},${item.y.toFixed(1)}`).join(' ');
  }, [selectedPlayerKey, filteredEvents]);

  if (match.events.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Flame className="h-4 w-4 text-[#22FF66] shrink-0" />
              <span>{isFa ? 'نقشه حرارتی تاکتیکی بازیکنان' : 'Tactical Player Movement Heatmap'}</span>
            </h2>
            <p className="text-xs text-slate-400">
              {isFa
                ? 'مدل فضایی مبتنی بر رویدادهای ثبت‌شده مسابقه'
                : 'Event-derived spatial activity model'}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-[#090B0E] border border-white/[0.06] p-8 text-center space-y-2">
          <p className="text-sm text-slate-300 font-medium">
            {isFa
              ? 'هنوز رویدادی برای ترسیم نقشه حرارتی این مسابقه ثبت نشده است.'
              : 'No match events recorded yet to render the tactical heatmap.'}
          </p>
          <p className="text-xs text-slate-500">
            {isFa
              ? 'به محض ثبت گل‌ها، کارت‌ها، تعویض‌ها یا صحنه‌های VAR، الگوی حرارتی تحرک بازیکنان به‌صورت خودکار تولید می‌شود.'
              : 'As soon as goals, cards, substitutions, or VAR incidents occur, player activity zones will populate live.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 min-w-0">
      {/* Header + Clean Unboxed Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Flame className="h-4 w-4 text-[#22FF66] shrink-0" />
            <span>{isFa ? 'نقشه حرارتی تاکتیکی بازیکنان' : 'Tactical Player Movement Heatmap'}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
            <span>
              {isFa
                ? 'مدل فضایی بر پایه رویدادهای واقعی مسابقه'
                : 'Event-derived spatial model'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-300">
              {isFa
                ? `${filteredEvents.length} رویداد فعال`
                : `${filteredEvents.length} mapped events`}
            </span>
            {match.lineups.homeXI.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {isFa ? 'همگام با ترکیب اصلی' : 'Formation-anchored'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Thermal Scale Legend */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
          <span>{isFa ? 'کم' : 'Low'}</span>
          <div
            className={`h-2 w-24 sm:w-28 rounded-full ${
              teamFilter === 'away'
                ? 'bg-gradient-to-r from-[#0e7490] via-[#38bdf8] via-60% to-[#ef4444]'
                : 'bg-gradient-to-r from-[#10875c] via-[#22FF66] via-45% via-[#f59e0b] to-[#ef4444]'
            }`}
          />
          <span>{isFa ? 'پرتراکم' : 'Peak'}</span>
        </div>
      </div>

      {/* Controls Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Team Segmented Filter */}
        <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 p-1 rounded-lg bg-[#090B0E] border border-white/[0.07] w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setTeamFilter('both')}
            className={`min-h-[40px] px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap truncate ${
              teamFilter === 'both'
                ? 'bg-[#181D24] text-white font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {isFa ? 'هر دو تیم' : 'Both Teams'}
          </button>
          <button
            type="button"
            onClick={() => setTeamFilter('home')}
            className={`min-h-[40px] px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap truncate ${
              teamFilter === 'home'
                ? 'bg-[#22FF66] text-[#090B0E] font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {homeTeam.shortName}
          </button>
          <button
            type="button"
            onClick={() => setTeamFilter('away')}
            className={`min-h-[40px] px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap truncate ${
              teamFilter === 'away'
                ? 'bg-sky-400 text-[#090B0E] font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {awayTeam.shortName}
          </button>
        </div>

        {/* Time Window + Player Selector + Layer Toggles */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {/* Half Filter */}
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#090B0E] border border-white/[0.07]">
            {(
              [
                { id: 'all', label: isFa ? 'کل بازی' : 'Full' },
                { id: 'first', label: isFa ? 'نیمه ۱' : '1st H' },
                { id: 'second', label: isFa ? 'نیمه ۲' : '2nd H' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setHalfFilter(opt.id)}
                className={`min-h-[36px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  halfFilter === opt.id
                    ? 'bg-[#181D24] text-[#22FF66] font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Player Focus Select */}
          <select
            aria-label={isFa ? 'فیلتر بازیکن' : 'Focus player'}
            value={selectedPlayerKey}
            onChange={(e) => {
              setSelectedPlayerKey(e.target.value);
              setFocusedEventId(null);
            }}
            className="min-h-[42px] max-w-full sm:max-w-[210px] px-3 rounded-lg bg-[#090B0E] border border-white/[0.1] text-xs text-white focus-visible:outline-none focus-visible:border-[#22FF66]"
          >
            <option value="all">
              {isFa ? `همه بازیکنان (${playerOptions.length})` : `All Players (${playerOptions.length})`}
            </option>
            {playerOptions.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label} ({p.count}) · {p.side === 'home' ? homeTeam.shortName : awayTeam.shortName}
              </option>
            ))}
          </select>

          {/* Overlay Layer Toggles */}
          <button
            type="button"
            onClick={() => setShowEventPins((v) => !v)}
            aria-pressed={showEventPins}
            className={`min-h-[42px] px-3 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              showEventPins
                ? 'bg-[#181D24] border-[#22FF66]/40 text-white'
                : 'bg-[#090B0E] border-white/[0.08] text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="h-3.5 w-3.5 text-[#22FF66]" />
            <span>{isFa ? 'رویدادها' : 'Events'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowZoneGrid((v) => !v)}
            aria-pressed={showZoneGrid}
            className={`min-h-[42px] px-3 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              showZoneGrid
                ? 'bg-[#181D24] border-white/[0.18] text-white'
                : 'bg-[#090B0E] border-white/[0.08] text-slate-400 hover:text-white'
            }`}
          >
            <Grid3X3 className="h-3.5 w-3.5 text-slate-300" />
            <span>{isFa ? 'شبکه مناطق' : 'Zones'}</span>
          </button>
        </div>
      </div>

      {/* Attacking Orientation Header */}
      <div
        dir="ltr"
        className="flex items-center justify-between text-[11px] font-medium text-slate-400 px-0.5"
      >
        <span className="truncate max-w-[46%] text-[#22FF66]">
          {homeName} →
        </span>
        <span className="truncate max-w-[46%] text-sky-400 text-right">
          ← {awayName}
        </span>
      </div>

      {/* Main Tactical Pitch + Thermal Heatmap Canvas */}
      <div
        dir="ltr"
        className="relative w-full aspect-[4/3] sm:aspect-[16/10] rounded-xl overflow-hidden bg-[#0B1711] border border-white/[0.09]"
      >
        {/* Layer 1: Mowed Dark-Turf Pitch Base */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        >
          <rect x="0" y="0" width="100" height="100" fill="#0B1711" />
          {[0, 16.66, 33.33, 50, 66.66, 83.33].map((xPos, i) => (
            <rect
              key={i}
              x={xPos}
              y="0"
              width="8.33"
              height="100"
              fill="#0E1D15"
            />
          ))}
        </svg>

        {/* Layer 2: Smooth Gaussian KDE Heatmap Canvas */}
        <canvas
          ref={canvasRef}
          width={240}
          height={150}
          className="absolute inset-0 w-full h-full pointer-events-none opacity-90"
        />

        {/* Layer 3: Crisp FIFA Pitch Lines, Tactical Zones & Movement Vectors */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        >
          {/* Optional 3x3 Tactical Zone Grid */}
          {showZoneGrid && (
            <g stroke="rgba(255,255,255,0.12)" strokeWidth="0.28" strokeDasharray="1.4 1.4">
              <line x1="33.33" y1="3" x2="33.33" y2="97" />
              <line x1="66.66" y1="3" x2="66.66" y2="97" />
              <line x1="3" y1="33.33" x2="97" y2="33.33" />
              <line x1="3" y1="66.66" x2="97" y2="66.66" />
            </g>
          )}

          {/* Outer Pitch Boundary */}
          <rect
            x="3"
            y="3"
            width="94"
            height="94"
            fill="none"
            stroke="rgba(255,255,255,0.34)"
            strokeWidth="0.4"
          />
          {/* Halfway Line & Center Circle */}
          <line
            x1="50"
            y1="3"
            x2="50"
            y2="97"
            stroke="rgba(255,255,255,0.34)"
            strokeWidth="0.4"
          />
          <ellipse
            cx="50"
            cy="50"
            rx="8.5"
            ry="13.5"
            fill="none"
            stroke="rgba(255,255,255,0.32)"
            strokeWidth="0.4"
          />
          <circle cx="50" cy="50" r="0.65" fill="rgba(255,255,255,0.5)" />

          {/* Left Penalty Area (Home defends) */}
          <rect
            x="3"
            y="21"
            width="15.5"
            height="58"
            fill="none"
            stroke="rgba(255,255,255,0.32)"
            strokeWidth="0.4"
          />
          <rect
            x="3"
            y="36"
            width="5.5"
            height="28"
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="0.38"
          />
          <circle cx="13.5" cy="50" r="0.55" fill="rgba(255,255,255,0.45)" />

          {/* Right Penalty Area (Away defends) */}
          <rect
            x="81.5"
            y="21"
            width="15.5"
            height="58"
            fill="none"
            stroke="rgba(255,255,255,0.32)"
            strokeWidth="0.4"
          />
          <rect
            x="91.5"
            y="36"
            width="5.5"
            height="28"
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="0.38"
          />
          <circle cx="86.5" cy="50" r="0.55" fill="rgba(255,255,255,0.45)" />

          {/* Goal Assist Vectors */}
          {showEventPins &&
            filteredEvents.map((item) =>
              item.assistX !== undefined && item.assistY !== undefined ? (
                <line
                  key={`assist-${item.event.id}`}
                  x1={item.assistX}
                  y1={item.assistY}
                  x2={item.x}
                  y2={item.y}
                  stroke={
                    item.event.teamSide === 'home'
                      ? 'rgba(34,255,102,0.75)'
                      : 'rgba(56,189,248,0.75)'
                  }
                  strokeWidth="0.5"
                  strokeDasharray="1.6 1.1"
                />
              ) : null
            )}

          {/* Chronological Player Movement Trail when inspecting a single player */}
          {playerTrailPoints && (
            <polyline
              points={playerTrailPoints}
              fill="none"
              stroke="rgba(255,255,255,0.75)"
              strokeWidth="0.55"
              strokeDasharray="2 1.2"
            />
          )}
        </svg>

        {/* Layer 4: Interactive Event Markers */}
        {showEventPins &&
          filteredEvents.map((item) => {
            const { event, x, y } = item;
            const isSelected = activeFocusedEvent?.event.id === event.id;
            const dotColor =
              event.type === 'goal'
                ? 'bg-[#22FF66] text-[#090B0E] border-white'
                : event.type === 'yellow'
                  ? 'bg-amber-400 text-[#090B0E] border-[#090B0E]'
                  : event.type === 'red'
                    ? 'bg-red-500 text-white border-white'
                    : event.type === 'var'
                      ? 'bg-violet-400 text-[#090B0E] border-white'
                      : event.teamSide === 'home'
                        ? 'bg-[#12161B] text-[#22FF66] border-[#22FF66]'
                        : 'bg-[#12161B] text-sky-300 border-sky-400';

            return (
              <button
                key={event.id}
                type="button"
                onClick={() => setFocusedEventId(event.id)}
                onMouseEnter={() => setFocusedEventId(event.id)}
                aria-label={`${event.minute}' ${localize(event.playerName)} ${eventTypeLabel(event.type)}`}
                style={{ left: `${x}%`, top: `${y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 min-w-[24px] h-[24px] sm:min-w-[28px] sm:h-[28px] px-1 rounded-full border text-[10px] sm:text-[11px] font-mono font-bold tabular-nums shadow-md transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${dotColor} ${
                  isSelected ? 'scale-125 z-20 ring-2 ring-white/80' : 'z-10 hover:scale-115'
                }`}
              >
                {event.minute}&apos;
              </button>
            );
          })}

        {/* Filtered-Empty Overlay */}
        {filteredEvents.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#090B0E]/65 p-4 text-center">
            <p className="text-xs sm:text-sm text-slate-300">
              {isFa
                ? 'در این بازه زمانی یا فیلتر انتخابی رویدادی ثبت نشده است.'
                : 'No match events recorded for the selected team or half filter.'}
            </p>
          </div>
        )}
      </div>

      {/* Selected Event Tactical Inspector Bar */}
      {activeFocusedEvent && (
        <div className="pt-3 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
            <span className="font-mono tabular-nums font-bold text-[#22FF66]">
              {activeFocusedEvent.event.minute}
              {activeFocusedEvent.event.addedTime ? `+${activeFocusedEvent.event.addedTime}` : ''}&apos;
            </span>
            <span className="font-semibold text-white truncate">
              {localize(activeFocusedEvent.event.playerName)}
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span
              className={`font-medium ${
                activeFocusedEvent.event.type === 'goal'
                  ? 'text-[#22FF66]'
                  : activeFocusedEvent.event.type === 'yellow'
                    ? 'text-amber-400'
                    : activeFocusedEvent.event.type === 'red'
                      ? 'text-red-400'
                      : 'text-slate-300'
              }`}
            >
              {eventTypeLabel(activeFocusedEvent.event.type)}
            </span>
            {activeFocusedEvent.event.assistOrDetail && (
              <>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-slate-400 truncate">
                  {localize(activeFocusedEvent.event.assistOrDetail)}
                </span>
              </>
            )}
          </div>
          <div className="text-slate-400 shrink-0">
            {isFa ? activeFocusedEvent.zoneFa : activeFocusedEvent.zoneEn}
          </div>
        </div>
      )}

      {/* Clean Unboxed Spatial Distribution Telemetry (Channels & Pitch Thirds) */}
      <div className="pt-4 border-t border-white/[0.06] grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Horizontal Pitch Thirds */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{isFa ? 'توزیع طولی فعالیت (یک‌سوم‌های زمین)' : 'Longitudinal Pitch Thirds'}</span>
            <span className="font-mono tabular-nums text-slate-300">
              {zoneMetrics.defPct}% / {zoneMetrics.midPct}% / {zoneMetrics.attPct}%
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: isFa ? 'دفاعی' : 'Defensive', value: zoneMetrics.defPct },
              { label: isFa ? 'میانی' : 'Middle', value: zoneMetrics.midPct },
              { label: isFa ? 'هجومی' : 'Final Third', value: zoneMetrics.attPct },
            ].map((z) => (
              <div key={z.label} className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-[#090B0E] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      teamFilter === 'away' ? 'bg-sky-400' : 'bg-[#22FF66]'
                    }`}
                    style={{ width: `${z.value}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 truncate">{z.label}</span>
                  <span className="font-mono tabular-nums text-slate-200">{z.value}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lateral Channels */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{isFa ? 'توزیع عرضی (کانال‌های زمین)' : 'Lateral Channels'}</span>
            <span className="font-mono tabular-nums text-slate-300">
              {zoneMetrics.leftPct}% / {zoneMetrics.centerPct}% / {zoneMetrics.rightPct}%
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: isFa ? 'چپ' : 'Left', value: zoneMetrics.leftPct },
              { label: isFa ? 'مرکز' : 'Center', value: zoneMetrics.centerPct },
              { label: isFa ? 'راست' : 'Right', value: zoneMetrics.rightPct },
            ].map((z) => (
              <div key={z.label} className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-[#090B0E] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${z.value}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 truncate">{z.label}</span>
                  <span className="font-mono tabular-nums text-slate-200">{z.value}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
