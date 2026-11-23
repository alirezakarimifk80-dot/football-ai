import React, { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { League, Match, Team, UserPreferences } from '../types/football';
import { useLanguage } from '../i18n/LanguageContext';
import { MatchRow } from '../components/matches/MatchRow';

interface LiveMatchesPageProps {
  leagues: League[];
  teams: Team[];
  matches: Match[];
  prefs: UserPreferences;
  isDemoData?: boolean;
  onOpenMatch: (matchId: string) => void;
  onToggleFavoriteMatch: (matchId: string) => void;
  onRefreshLive: () => Promise<void>;
  refreshing: boolean;
}

export const LiveMatchesPage: React.FC<LiveMatchesPageProps> = ({
  leagues,
  teams,
  matches,
  prefs,
  isDemoData = false,
  onOpenMatch,
  onToggleFavoriteMatch,
  onRefreshLive,
  refreshing,
}) => {
  const { t, lang, localize } = useLanguage();
  const hasAnyLive = useMemo(
    () => matches.some((m) => m.status === 'LIVE' || m.status === 'HT'),
    [matches]
  );
  const [onlyLive, setOnlyLive] = useState(hasAnyLive);
  const [leagueFilter, setLeagueFilter] = useState('all');

  const teamMap = useMemo(() => new Map(teams.map((tm) => [tm.id, tm])), [teams]);
  const leagueMap = useMemo(() => new Map(leagues.map((lg) => [lg.id, lg])), [leagues]);

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      if (onlyLive && m.status !== 'LIVE' && m.status !== 'HT') return false;
      if (!onlyLive && m.dayOffset !== 0) return false;
      if (leagueFilter !== 'all' && m.leagueId !== leagueFilter) return false;
      return true;
    });
  }, [matches, onlyLive, leagueFilter]);

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-full min-w-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3.5 sm:gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{t.livePage.title}</h1>
            {!isDemoData && (
              <span className="text-xs font-mono text-[#22FF66]">
                · {lang === 'fa' ? 'همگام‌سازی زنده واقعی' : 'Real-Time Sync'}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{t.livePage.subtitle}</p>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={onRefreshLive}
          className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-lg bg-[#181D24] border border-white/[0.1] hover:border-[#22FF66]/50 text-xs sm:text-sm font-medium text-slate-100 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-60 transition-colors"
        >
          <RefreshCw
            className={`h-4 w-4 text-[#22FF66] shrink-0 ${refreshing ? 'animate-spin' : ''}`}
          />
          <span>{t.livePage.simulateTick}</span>
        </button>
      </div>

      {/* Segmented Status & Competition Controls */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3 min-w-0">
        <div className="grid grid-cols-2 sm:inline-flex items-center gap-1 p-1 rounded-lg bg-[#12161B] border border-white/[0.07] w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setOnlyLive(true)}
            className={`min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              onlyLive ? 'bg-[#22FF66] text-[#090B0E] font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.livePage.liveOnly}
          </button>
          <button
            type="button"
            onClick={() => setOnlyLive(false)}
            className={`min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              !onlyLive ? 'bg-[#22FF66] text-[#090B0E] font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.livePage.allMatches}
          </button>
        </div>

        <div className="w-full sm:w-auto max-w-full flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => setLeagueFilter('all')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 border ${
              leagueFilter === 'all'
                ? 'bg-[#181D24] text-[#22FF66] border-[#22FF66]/40'
                : 'bg-[#12161B] text-slate-400 border-white/[0.06] hover:text-white'
            }`}
          >
            {t.common.allLeagues}
          </button>
          {leagues.map((lg) => (
            <button
              key={lg.id}
              type="button"
              onClick={() => setLeagueFilter(lg.id)}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 border ${
                leagueFilter === lg.id
                  ? 'bg-[#181D24] text-[#22FF66] border-[#22FF66]/40'
                  : 'bg-[#12161B] text-slate-400 border-white/[0.06] hover:text-white'
              }`}
            >
              {localize(lg.name)}
            </button>
          ))}
        </div>
      </div>

      {/* Matches List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl bg-[#12161B] border border-white/[0.07] p-10 text-center space-y-3">
          <p className="text-sm text-slate-400">{t.livePage.noLiveMatches}</p>
          <button
            type="button"
            onClick={() => {
              setOnlyLive(false);
              setLeagueFilter('all');
            }}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-[#181D24] text-xs font-medium text-white"
          >
            {t.livePage.allMatches}
          </button>
        </div>
      ) : (
        <div className="rounded-xl bg-[#12161B] border border-white/[0.07] divide-y divide-white/[0.06] overflow-hidden">
          {filtered.map((m) => {
            const home = teamMap.get(m.homeTeamId);
            const away = teamMap.get(m.awayTeamId);
            const league = leagueMap.get(m.leagueId);
            if (!home || !away) return null;
            return (
              <div key={m.id}>
                {league && (
                  <div className="px-3.5 sm:px-4 pt-3 pb-1 text-[11px] text-slate-500 flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[#22FF66] shrink-0">{league.code}</span>
                    <span className="truncate">{localize(league.name)}</span>
                    <span aria-hidden="true" className="shrink-0">·</span>
                    <span className="truncate">{localize(m.round)}</span>
                  </div>
                )}
                <MatchRow
                  match={m}
                  homeTeam={home}
                  awayTeam={away}
                  isFavorite={prefs.favoriteMatchIds.includes(m.id)}
                  showXg={prefs.showXgOnCards}
                  compact={prefs.compactMatchRows}
                  isDemoData={isDemoData}
                  onSelect={onOpenMatch}
                  onToggleFavorite={onToggleFavoriteMatch}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
