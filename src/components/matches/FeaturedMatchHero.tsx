import React from 'react';
import { Sparkles, ArrowUpRight } from 'lucide-react';
import type { League, Match, Team } from '../../types/football';
import { useLanguage } from '../../i18n/LanguageContext';
import { TeamCrest } from '../ui/TeamCrest';
import { SafeImage } from '../ui/SafeImage';
import { MatchProgressBar } from './MatchProgressBar';

interface FeaturedMatchHeroProps {
  match: Match;
  league: League;
  homeTeam: Team;
  awayTeam: Team;
  isDemoData?: boolean;
  onOpenMatch: (matchId: string) => void;
  onOpenAiLab: (matchId: string) => void;
}

const HERO_IMAGE = '/src/assets/images/hero_stadium_night_1795373660476.jpg';

export const FeaturedMatchHero: React.FC<FeaturedMatchHeroProps> = ({
  match,
  league,
  homeTeam,
  awayTeam,
  isDemoData = false,
  onOpenMatch,
  onOpenAiLab,
}) => {
  const { t, lang, localize } = useLanguage();
  const isInPlay = match.status === 'LIVE';

  const statusBadgeText = isInPlay
    ? isDemoData
      ? `${t.common.demoDataLabel} · ${match.minute ?? 1}${t.common.minuteSuffix}`
      : `${t.common.liveNow} · ${match.minute ?? 1}${t.common.minuteSuffix}`
    : match.status === 'HT'
      ? `${isDemoData ? `${t.common.demoDataLabel} · ` : ''}${t.common.halftime}`
      : match.kickoffTime;

  return (
    <section className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#12161B] w-full max-w-full">
      {/* Background Stadium Photography with Measured Scrim */}
      <div className="absolute inset-0">
        <SafeImage
          src={HERO_IMAGE}
          alt={localize(match.venue)}
          className="w-full h-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090B0E] via-[#090B0E]/85 to-[#090B0E]/60" />
      </div>

      <div className="relative z-10 p-4 sm:p-6 lg:p-7 space-y-5 sm:space-y-6">
        {/* Clean unboxed metadata kicker */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] sm:text-xs text-slate-300">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
            <span className="font-semibold text-[#22FF66]">{t.home.featuredKicker}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="truncate">{localize(league.name)}</span>
            <span aria-hidden="true" className="text-slate-600 hidden sm:inline">·</span>
            <span className="text-slate-400 hidden sm:inline">{localize(match.round)}</span>
          </div>
          <span className="font-mono tabular-nums text-slate-200 shrink-0">
            {statusBadgeText}
          </span>
        </div>

        {/* Balanced 3-column Matchup Scoreboard (360px safe!) */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-5 lg:gap-6">
          {/* Home Team */}
          <div className="min-w-0 flex flex-col sm:flex-row items-center sm:justify-end gap-2 sm:gap-3 text-center sm:text-end">
            <div className="order-2 sm:order-1 min-w-0 w-full sm:w-auto">
              <h1 className="text-sm sm:text-xl lg:text-2xl font-bold text-white leading-snug line-clamp-2 break-words">
                {localize(homeTeam.name)}
              </h1>
              {(match.lineups.homeFormation !== '—' || match.hasXg) && (
                <p className="text-[11px] sm:text-xs font-mono tabular-nums text-slate-400 mt-0.5 truncate">
                  {match.lineups.homeFormation !== '—' ? match.lineups.homeFormation : ''}
                  {match.lineups.homeFormation !== '—' && match.hasXg ? ' · ' : ''}
                  {match.hasXg ? `${lang === 'fa' ? 'xG' : t.common.xG} ${match.stats.xG[0].toFixed(2)}` : ''}
                </p>
              )}
            </div>
            <TeamCrest
              team={homeTeam}
              size={44}
              className="order-1 sm:order-2 w-10 h-10 sm:w-12 sm:h-12"
            />
          </div>

          {/* Center Score Box */}
          <div className="shrink-0 flex flex-col items-center px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-[#090B0E]/90 border border-white/[0.1] backdrop-blur-sm min-w-[74px] sm:min-w-[104px]">
            <div
              dir="ltr"
              className="text-xl sm:text-3xl lg:text-4xl font-mono font-bold tabular-nums tracking-tight text-white whitespace-nowrap"
            >
              {match.homeScore ?? 0}
              <span className="text-slate-500 mx-1 sm:mx-1.5">:</span>
              {match.awayScore ?? 0}
            </div>
            <span className="text-[10px] sm:text-[11px] font-mono tabular-nums text-[#22FF66] mt-0.5 whitespace-nowrap">
              {isInPlay
                ? `${isDemoData ? (lang === 'fa' ? 'آزمایشی ' : 'Demo ') : ''}${match.minute}${t.common.minuteSuffix}`
                : match.status}
            </span>
          </div>

          {/* Away Team */}
          <div className="min-w-0 flex flex-col sm:flex-row items-center sm:justify-start gap-2 sm:gap-3 text-center sm:text-start">
            <TeamCrest
              team={awayTeam}
              size={44}
              className="w-10 h-10 sm:w-12 sm:h-12"
            />
            <div className="min-w-0 w-full sm:w-auto">
              <h2 className="text-sm sm:text-xl lg:text-2xl font-bold text-white leading-snug line-clamp-2 break-words">
                {localize(awayTeam.name)}
              </h2>
              {(match.lineups.awayFormation !== '—' || match.hasXg) && (
                <p className="text-[11px] sm:text-xs font-mono tabular-nums text-slate-400 mt-0.5 truncate">
                  {match.lineups.awayFormation !== '—' ? match.lineups.awayFormation : ''}
                  {match.lineups.awayFormation !== '—' && match.hasXg ? ' · ' : ''}
                  {match.hasXg ? `${lang === 'fa' ? 'xG' : t.common.xG} ${match.stats.xG[1].toFixed(2)}` : ''}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Live / Completed Match Time Progress & Event Timeline */}
        {match.status !== 'UPCOMING' && (
          <div className="max-w-xl mx-auto w-full pt-1">
            <MatchProgressBar
              match={match}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
            />
          </div>
        )}

        {/* Win Probability Bar + Responsive Full-Fit Action Buttons */}
        <div className="pt-4 border-t border-white/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="w-full lg:flex-1 lg:max-w-md space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] sm:text-xs text-slate-400">
              <span>{t.home.winProb}</span>
              <span dir="ltr" className="font-mono tabular-nums text-slate-300 whitespace-nowrap">
                {homeTeam.shortName} {match.winProbability.home}% · {t.home.draw}{' '}
                {match.winProbability.draw}% · {awayTeam.shortName} {match.winProbability.away}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-white/[0.08]" dir="ltr">
              <div
                className="bg-[#22FF66] h-full"
                style={{ width: `${match.winProbability.home}%` }}
              />
              <div
                className="bg-slate-500 h-full"
                style={{ width: `${match.winProbability.draw}%` }}
              />
              <div
                className="bg-sky-400 h-full"
                style={{ width: `${match.winProbability.away}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => onOpenMatch(match.id)}
              className="min-h-[44px] px-3 sm:px-4 py-2 rounded-lg bg-[#22FF66] text-[#090B0E] text-xs sm:text-sm font-semibold hover:bg-[#3bff77] transition-colors inline-flex items-center justify-center gap-1.5 min-w-0"
            >
              <span className="truncate">{t.common.viewMatchCenter}</span>
              <ArrowUpRight className="h-4 w-4 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => onOpenAiLab(match.id)}
              className="min-h-[44px] px-3 sm:px-4 py-2 rounded-lg bg-[#181D24] border border-white/[0.1] text-slate-100 text-xs sm:text-sm font-medium hover:bg-[#1E252E] transition-colors inline-flex items-center justify-center gap-1.5 min-w-0"
            >
              <Sparkles className="h-4 w-4 text-[#22FF66] shrink-0" />
              <span className="truncate">{t.common.analyzeWithAi}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
