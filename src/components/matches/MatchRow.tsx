import React from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import type { Match, Team } from '../../types/football';
import { useLanguage } from '../../i18n/LanguageContext';
import { TeamCrest } from '../ui/TeamCrest';
import { MatchProgressBar } from './MatchProgressBar';

interface MatchRowProps {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  isFavorite: boolean;
  showXg: boolean;
  compact?: boolean;
  isDemoData?: boolean;
  onSelect: (matchId: string) => void;
  onToggleFavorite: (matchId: string) => void;
}

export const MatchRow: React.FC<MatchRowProps> = ({
  match,
  homeTeam,
  awayTeam,
  isFavorite,
  showXg,
  compact = false,
  isDemoData = false,
  onSelect,
  onToggleFavorite,
}) => {
  const { t, lang, isRtl, localize } = useLanguage();
  const isLive = match.status === 'LIVE';
  const isHt = match.status === 'HT';
  const isUpcoming = match.status === 'UPCOMING';

  const statusText = isLive
    ? `${match.minute ?? 1}${t.common.minuteSuffix}`
    : isHt
      ? t.common.halftime
      : match.status === 'FT'
        ? t.common.fullTime
        : match.kickoffTime;

  const shortDemoLabel = lang === 'fa' ? 'آزمایشی' : 'Demo';

  const statusSubLabel = isLive
    ? isDemoData
      ? shortDemoLabel
      : t.common.liveNow
    : isHt && isDemoData
      ? shortDemoLabel
      : null;

  const statusClass = isLive
    ? 'text-[#22FF66] font-semibold'
    : isHt
      ? 'text-amber-400 font-semibold'
      : 'text-slate-400';

  return (
    <div
      className={`group flex items-center gap-2 sm:gap-3 transition-colors hover:bg-[#181D24] w-full max-w-full ${
        compact ? 'px-3 py-2.5 sm:px-3.5' : 'px-3.5 py-3 sm:px-4 sm:py-3.5'
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(match.id)}
        className="flex-1 min-w-0 flex items-center gap-2.5 sm:gap-4 text-start focus-visible:outline-none"
      >
        {/* Status / Clock Column */}
        <div className="w-11 sm:w-14 shrink-0 text-center">
          <div className={`text-xs font-mono tabular-nums ${statusClass}`}>{statusText}</div>
          {statusSubLabel && (
            <div className="text-[9px] sm:text-[10px] text-slate-400 font-medium mt-0.5 truncate">
              {statusSubLabel}
            </div>
          )}
        </div>

        {/* Mobile Stacked FotMob Layout (< sm, 360px-639px) — prevents long team names from ever cramping */}
        <div className="flex-1 min-w-0 sm:hidden space-y-1.5">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <TeamCrest team={homeTeam} size={20} />
              <span className="text-[13px] font-medium text-slate-100 truncate">
                {localize(homeTeam.name)}
              </span>
            </div>
            <span
              className={`font-mono text-sm font-bold tabular-nums shrink-0 ${
                isUpcoming ? 'text-slate-500' : isLive ? 'text-[#22FF66]' : 'text-white'
              }`}
            >
              {isUpcoming ? '-' : match.homeScore ?? 0}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <TeamCrest team={awayTeam} size={20} />
              <span className="text-[13px] font-medium text-slate-100 truncate">
                {localize(awayTeam.name)}
              </span>
            </div>
            <span
              className={`font-mono text-sm font-bold tabular-nums shrink-0 ${
                isUpcoming ? 'text-slate-500' : isLive ? 'text-[#22FF66]' : 'text-white'
              }`}
            >
              {isUpcoming ? '-' : match.awayScore ?? 0}
            </span>
          </div>

          {!isUpcoming && (
            <MatchProgressBar
              match={match}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              compact
              showTimeLabels={!compact}
              className="pt-0.5"
            />
          )}

          {showXg && match.hasXg && !isUpcoming && (
            <div className="text-[10px] font-mono tabular-nums text-slate-500">
              xG {match.stats.xG[0].toFixed(2)} – {match.stats.xG[1].toFixed(2)}
            </div>
          )}
        </div>

        {/* Tablet & Desktop Horizontal Layout (>= sm) */}
        <div className="hidden sm:flex flex-1 min-w-0 flex-col gap-1.5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 md:gap-4">
            {/* Home Team */}
            <div className="flex items-center justify-end gap-2.5 min-w-0">
              <span className="text-sm font-medium text-slate-100 truncate">
                {localize(homeTeam.name)}
              </span>
              <TeamCrest team={homeTeam} size={compact ? 22 : 26} />
            </div>

            {/* Scoreline */}
            <div className="px-2.5 py-1 rounded-md bg-[#090B0E] border border-white/[0.06] min-w-[64px] text-center shrink-0">
              {isUpcoming ? (
                <span className="text-xs font-mono tabular-nums text-slate-400">
                  {match.kickoffTime}
                </span>
              ) : (
                <span
                  dir="ltr"
                  className={`text-sm font-mono font-bold tabular-nums ${
                    isLive ? 'text-[#22FF66]' : 'text-white'
                  }`}
                >
                  {match.homeScore ?? 0} - {match.awayScore ?? 0}
                </span>
              )}
            </div>

            {/* Away Team */}
            <div className="flex items-center justify-start gap-2.5 min-w-0">
              <TeamCrest team={awayTeam} size={compact ? 22 : 26} />
              <span className="text-sm font-medium text-slate-100 truncate">
                {localize(awayTeam.name)}
              </span>
            </div>
          </div>

          {!isUpcoming && (
            <div className="w-full max-w-md mx-auto">
              <MatchProgressBar
                match={match}
                homeTeam={homeTeam}
                awayTeam={awayTeam}
                compact={compact}
                showTimeLabels={!compact}
              />
            </div>
          )}
        </div>

        {/* Optional xG column (Desktop) */}
        {showXg && match.hasXg && !isUpcoming && (
          <div className="hidden md:flex flex-col items-end shrink-0 w-20 text-xs font-mono tabular-nums text-slate-400">
            <span className="text-[10px] text-slate-500">{t.common.xG}</span>
            <span dir="ltr">
              {match.stats.xG[0].toFixed(2)} - {match.stats.xG[1].toFixed(2)}
            </span>
          </div>
        )}

        {isRtl ? (
          <ChevronLeft className="h-4 w-4 text-slate-600 group-hover:text-slate-300 shrink-0 hidden sm:block transition-transform group-hover:-translate-x-0.5" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-300 shrink-0 hidden sm:block transition-transform group-hover:translate-x-0.5" />
        )}
      </button>

      {/* Favorite button with >=44px touch hitbox */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(match.id);
        }}
        aria-label={isFavorite ? t.common.favorited : t.common.favorite}
        className={`min-h-[44px] min-w-[44px] -me-1.5 flex items-center justify-center rounded-lg transition-colors shrink-0 ${
          isFavorite ? 'text-[#22FF66]' : 'text-slate-600 hover:text-slate-300'
        }`}
      >
        <Star className={`h-4 w-4 ${isFavorite ? 'fill-[#22FF66]' : ''}`} />
      </button>
    </div>
  );
};
