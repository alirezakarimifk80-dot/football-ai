import React, { useMemo } from 'react';
import type { Match, MatchEvent, Team } from '../../types/football';
import { useLanguage } from '../../i18n/LanguageContext';

interface MatchProgressBarProps {
  match: Match;
  homeTeam?: Team;
  awayTeam?: Team;
  compact?: boolean;
  showTimeLabels?: boolean;
  className?: string;
}

interface PositionedEvent {
  event: MatchEvent;
  pct: number;
  effectiveMinute: number;
}

const MAJOR_EVENT_TYPES = new Set<MatchEvent['type']>(['goal', 'yellow', 'red', 'var']);

function formatEventTypeLabel(type: MatchEvent['type'], lang: 'en' | 'fa'): string {
  if (lang === 'fa') {
    if (type === 'goal') return 'گل';
    if (type === 'red') return 'کارت قرمز';
    if (type === 'yellow') return 'کارت زرد';
    if (type === 'var') return 'VAR';
    return 'رویداد';
  }
  if (type === 'goal') return 'Goal';
  if (type === 'red') return 'Red Card';
  if (type === 'yellow') return 'Yellow Card';
  if (type === 'var') return 'VAR';
  return 'Event';
}

export const MatchProgressBar: React.FC<MatchProgressBarProps> = ({
  match,
  homeTeam,
  awayTeam,
  compact = false,
  showTimeLabels = true,
  className = '',
}) => {
  const { lang, localize } = useLanguage();
  const isLive = match.status === 'LIVE';
  const isHt = match.status === 'HT';
  const isFt = match.status === 'FT';
  const isUpcoming = match.status === 'UPCOMING';

  const {
    maxMinute,
    hasStoppageTime,
    progressPct,
    htPct,
    positionedEvents,
    goalCount,
    cardCount,
  } = useMemo(() => {
    const majorEvents = (match.events ?? [])
      .filter((ev) => MAJOR_EVENT_TYPES.has(ev.type))
      .sort((a, b) => a.minute + (a.addedTime ?? 0) - (b.minute + (b.addedTime ?? 0)));

    const maxEvMin = majorEvents.reduce(
      (max, ev) => Math.max(max, ev.minute + (ev.addedTime ?? 0)),
      0
    );
    const liveMin = match.minute ?? 0;
    const rawMax = Math.max(90, maxEvMin, isLive ? liveMin : 90);
    const stoppage =
      liveMin > 90 ||
      maxEvMin > 90 ||
      majorEvents.some((ev) => (ev.addedTime ?? 0) > 0 && ev.minute >= 90);

    let pct = 0;
    if (isFt) {
      pct = 100;
    } else if (isHt) {
      pct = (45 / rawMax) * 100;
    } else if (isLive) {
      pct = Math.max(2, Math.min(100, (Math.max(1, liveMin) / rawMax) * 100));
    }

    // Spread markers slightly if two events on the same team side share almost the same minute
    const lastPctBySide: Record<'home' | 'away', number> = { home: -10, away: -10 };
    const positioned: PositionedEvent[] = majorEvents.map((ev) => {
      const effMin = ev.minute + (ev.addedTime ?? 0);
      let rawPct = Math.max(2.5, Math.min(97.5, (effMin / rawMax) * 100));
      const prev = lastPctBySide[ev.teamSide];
      if (rawPct - prev < 2.4) {
        rawPct = Math.min(98, prev + 2.4);
      }
      lastPctBySide[ev.teamSide] = rawPct;
      return { event: ev, pct: rawPct, effectiveMinute: effMin };
    });

    const goals = majorEvents.filter((ev) => ev.type === 'goal').length;
    const cards = majorEvents.filter((ev) => ev.type === 'yellow' || ev.type === 'red').length;

    return {
      maxMinute: rawMax,
      hasStoppageTime: stoppage,
      progressPct: pct,
      htPct: (45 / rawMax) * 100,
      positionedEvents: positioned,
      goalCount: goals,
      cardCount: cards,
    };
  }, [match.events, match.minute, isFt, isHt, isLive]);

  const svgHeight = compact ? 20 : 24;
  const trackY = compact ? 8.5 : 10.5;
  const trackHeight = 3;
  const homeMarkerY = compact ? 3.5 : 4.2;
  const awayMarkerY = compact ? 16.5 : 19.8;

  const fillColor = isLive ? '#22FF66' : isHt ? '#FBBF24' : isFt ? '#22FF66' : 'transparent';
  const fillOpacity = isLive ? 0.95 : isHt ? 0.85 : isFt ? 0.45 : 0;

  const endLabel =
    hasStoppageTime || maxMinute > 90
      ? maxMinute > 90
        ? `90+${maxMinute - 90}'`
        : "90+'"
      : "90'";

  const ariaSummary = isUpcoming
    ? lang === 'fa'
      ? `پیش از شروع مسابقه · ${match.kickoffTime}`
      : `Kickoff ${match.kickoffTime}`
    : lang === 'fa'
      ? `نوار زمان مسابقه (${isFt ? 'پایان بازی' : isHt ? 'بین دو نیمه' : `دقیقه ${match.minute ?? 1}`}) · ${goalCount} گل، ${cardCount} کارت`
      : `Match timeline (${isFt ? 'Full Time' : isHt ? 'Half Time' : `${match.minute ?? 1}'`}) · ${goalCount} goals, ${cardCount} cards`;

  return (
    <div
      dir="ltr"
      className={`w-full select-none ${className}`}
      role="img"
      aria-label={ariaSummary}
    >
      <svg
        className={`w-full block overflow-visible ${compact ? 'h-5' : 'h-6'}`}
        height={svgHeight}
      >
        {/* Base timeline track */}
        <rect
          x="0%"
          y={trackY}
          width="100%"
          height={trackHeight}
          rx={trackHeight / 2}
          fill={isUpcoming ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)'}
        />

        {/* Elapsed time fill */}
        {progressPct > 0 && (
          <rect
            x="0%"
            y={trackY}
            width={`${progressPct}%`}
            height={trackHeight}
            rx={trackHeight / 2}
            fill={fillColor}
            fillOpacity={fillOpacity}
          />
        )}

        {/* Half-time (45') marker hairline */}
        <line
          x1={`${htPct}%`}
          y1={trackY - 2.5}
          x2={`${htPct}%`}
          y2={trackY + trackHeight + 2.5}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
        />

        {/* Live leading-edge pulse dot */}
        {isLive && (
          <g>
            <circle
              cx={`${progressPct}%`}
              cy={trackY + trackHeight / 2}
              r="5.2"
              fill="#22FF66"
              fillOpacity="0.25"
              className="animate-pulse"
            />
            <circle
              cx={`${progressPct}%`}
              cy={trackY + trackHeight / 2}
              r="2.6"
              fill="#22FF66"
              stroke="#090B0E"
              strokeWidth="1"
            />
          </g>
        )}

        {/* Major Event Markers (Home on top lane, Away on bottom lane) */}
        {positionedEvents.map(({ event, pct }) => {
          const isHome = event.teamSide === 'home';
          const markerY = isHome ? homeMarkerY : awayMarkerY;
          const teamLabel = isHome
            ? homeTeam
              ? localize(homeTeam.name)
              : lang === 'fa'
                ? 'میزبان'
                : 'Home'
            : awayTeam
              ? localize(awayTeam.name)
              : lang === 'fa'
                ? 'مهمان'
                : 'Away';
          const minuteLabel = event.addedTime
            ? `${event.minute}+${event.addedTime}'`
            : `${event.minute}'`;
          const tooltip = `${minuteLabel} · ${formatEventTypeLabel(event.type, lang)} · ${localize(
            event.playerName
          )} (${teamLabel})`;

          return (
            <g key={event.id}>
              <title>{tooltip}</title>
              {/* Subtle connector stem from marker to track */}
              <line
                x1={`${pct}%`}
                y1={isHome ? markerY + 2.5 : trackY + trackHeight}
                x2={`${pct}%`}
                y2={isHome ? trackY : markerY - 2.5}
                stroke={
                  event.type === 'goal'
                    ? 'rgba(34,255,102,0.55)'
                    : event.type === 'red'
                      ? 'rgba(239,68,68,0.65)'
                      : event.type === 'yellow'
                        ? 'rgba(250,204,21,0.5)'
                        : 'rgba(56,189,248,0.55)'
                }
                strokeWidth="1"
              />

              {event.type === 'goal' && (
                <>
                  <circle
                    cx={`${pct}%`}
                    cy={markerY}
                    r={compact ? '2.8' : '3.3'}
                    fill="#22FF66"
                    stroke="#090B0E"
                    strokeWidth="1.1"
                  />
                  <circle cx={`${pct}%`} cy={markerY} r="1" fill="#090B0E" />
                </>
              )}

              {event.type === 'yellow' && (
                <rect
                  x={`${pct}%`}
                  y={markerY - (compact ? 2.8 : 3.2)}
                  width={compact ? '4' : '4.6'}
                  height={compact ? '5.6' : '6.4'}
                  rx="0.9"
                  transform={`translate(${compact ? -2 : -2.3} 0)`}
                  fill="#FACC15"
                  stroke="#090B0E"
                  strokeWidth="0.9"
                />
              )}

              {event.type === 'red' && (
                <rect
                  x={`${pct}%`}
                  y={markerY - (compact ? 2.8 : 3.2)}
                  width={compact ? '4.2' : '4.8'}
                  height={compact ? '5.6' : '6.4'}
                  rx="0.9"
                  transform={`translate(${compact ? -2.1 : -2.4} 0)`}
                  fill="#EF4444"
                  stroke="#090B0E"
                  strokeWidth="0.9"
                />
              )}

              {event.type === 'var' && (
                <rect
                  x={`${pct}%`}
                  y={markerY - 2.5}
                  width="5"
                  height="5"
                  rx="1"
                  transform={`translate(-2.5 0)`}
                  fill="#38BDF8"
                  stroke="#090B0E"
                  strokeWidth="0.9"
                />
              )}
            </g>
          );
        })}
      </svg>

      {showTimeLabels && (
        <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono tabular-nums text-slate-500 leading-none mt-0.5">
          <span>0&apos;</span>
          <span className={isHt ? 'text-amber-400 font-semibold' : ''}>HT</span>
          <span className={isLive && (match.minute ?? 0) > 90 ? 'text-[#22FF66] font-semibold' : ''}>
            {endLabel}
          </span>
        </div>
      )}
    </div>
  );
};
