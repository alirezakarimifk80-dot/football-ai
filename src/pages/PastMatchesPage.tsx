import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, RefreshCw, Search, Star } from 'lucide-react';
import type { League, Match, Team, UserPreferences } from '../types/football';
import { useLanguage } from '../i18n/LanguageContext';
import { footballService } from '../services/footballService';
import { TeamCrest } from '../components/ui/TeamCrest';

interface PastMatchesPageProps {
  leagues: League[];
  baseTeams: Team[];
  prefs: UserPreferences;
  onOpenPastMatch: (match: Match, archiveTeams: Team[]) => void;
  onToggleFavoriteMatch: (matchId: string) => void;
}

function formatDateHeading(isoDate: string, lang: 'en' | 'fa'): string {
  if (!isoDate || isoDate === 'unknown') {
    return lang === 'fa' ? 'تاریخ نامشخص' : 'Recent';
  }
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  try {
    if (lang === 'fa') {
      const persian = new Intl.DateTimeFormat('fa-IR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(d);
      return `${persian} · ${isoDate}`;
    }
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return isoDate;
  }
}

export const PastMatchesPage: React.FC<PastMatchesPageProps> = ({
  leagues,
  baseTeams,
  prefs,
  onOpenPastMatch,
  onToggleFavoriteMatch,
}) => {
  const { t, lang, isRtl, localize } = useLanguage();
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [archiveTeams, setArchiveTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadArchive = useCallback(async (leagueId: string, forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const env = await footballService.getPastMatches(leagueId, forceRefresh);
      setMatches(env.data.matches);
      setArchiveTeams(env.data.teams);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.pastMatchesPage.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t.pastMatchesPage.loadError]);

  useEffect(() => {
    loadArchive(selectedLeagueId, false);
  }, [selectedLeagueId, loadArchive]);

  const leagueMap = useMemo(() => new Map(leagues.map((l) => [l.id, l])), [leagues]);
  const teamMap = useMemo(() => {
    const map = new Map<string, Team>();
    for (const tm of baseTeams) map.set(tm.id, tm);
    for (const tm of archiveTeams) {
      if (!map.has(tm.id)) map.set(tm.id, tm);
    }
    return map;
  }, [baseTeams, archiveTeams]);

  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter((m) => {
      const home = teamMap.get(m.homeTeamId);
      const away = teamMap.get(m.awayTeamId);
      const league = leagueMap.get(m.leagueId);
      const haystack = [
        home?.name.en,
        home?.name.fa,
        away?.name.en,
        away?.name.fa,
        league?.name.en,
        league?.name.fa,
        m.round.en,
        m.round.fa,
        m.matchDate,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [matches, searchQuery, teamMap, leagueMap]);

  const groupedByDate = useMemo(() => {
    const groups: { date: string; items: Match[] }[] = [];
    const indexByDate = new Map<string, number>();
    for (const m of filteredMatches) {
      const key = m.matchDate ?? 'unknown';
      const existingIdx = indexByDate.get(key);
      if (existingIdx !== undefined) {
        groups[existingIdx].items.push(m);
      } else {
        indexByDate.set(key, groups.length);
        groups.push({ date: key, items: [m] });
      }
    }
    return groups;
  }, [filteredMatches]);

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-full min-w-0">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{t.pastMatchesPage.title}</h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-3xl leading-relaxed">
            {t.pastMatchesPage.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!loading && (
            <span className="text-xs font-mono tabular-nums text-slate-400 whitespace-nowrap">
              {filteredMatches.length} {t.pastMatchesPage.matchesCount}
            </span>
          )}
          <button
            type="button"
            disabled={refreshing || loading}
            onClick={() => loadArchive(selectedLeagueId, true)}
            className="min-h-[42px] px-3.5 py-2 rounded-lg bg-[#12161B] border border-white/[0.08] hover:border-[#22FF66]/50 text-xs font-semibold text-slate-200 hover:text-white inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#22FF66] ${refreshing ? 'animate-spin' : ''}`} />
            <span>{t.pastMatchesPage.refreshArchive}</span>
          </button>
        </div>
      </div>

      {/* League Filter Bar */}
      <div className="w-full max-w-full flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => setSelectedLeagueId('all')}
          className={`min-h-[42px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 border ${
            selectedLeagueId === 'all'
              ? 'bg-[#22FF66] text-[#090B0E] border-[#22FF66] font-semibold'
              : 'bg-[#12161B] text-slate-300 border-white/[0.07] hover:text-white'
          }`}
        >
          {t.common.allLeagues}
        </button>
        {leagues.map((lg) => {
          const active = selectedLeagueId === lg.id;
          return (
            <button
              key={lg.id}
              type="button"
              onClick={() => setSelectedLeagueId(lg.id)}
              className={`min-h-[42px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 border ${
                active
                  ? 'bg-[#22FF66] text-[#090B0E] border-[#22FF66] font-semibold'
                  : 'bg-[#12161B] text-slate-300 border-white/[0.07] hover:text-white'
              }`}
            >
              {localize(lg.name)}
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="h-4 w-4 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.pastMatchesPage.searchPlaceholder}
          className="w-full min-h-[44px] ps-10 pe-4 py-2 rounded-xl bg-[#12161B] border border-white/[0.08] text-sm text-white placeholder:text-slate-500 focus:border-[#22FF66] focus:outline-none"
        />
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div className="rounded-2xl bg-[#12161B] border border-white/[0.07] divide-y divide-white/[0.06] overflow-hidden">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="px-4 sm:px-5 py-4 flex items-center justify-between gap-4 animate-pulse">
              <div className="h-4 w-24 rounded bg-white/[0.06]" />
              <div className="flex-1 flex items-center justify-center gap-4">
                <div className="h-4 w-28 rounded bg-white/[0.07]" />
                <div className="h-5 w-12 rounded bg-white/[0.1]" />
                <div className="h-4 w-28 rounded bg-white/[0.07]" />
              </div>
              <div className="h-4 w-20 rounded bg-white/[0.06] hidden sm:block" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="rounded-2xl bg-[#12161B] border border-red-500/30 p-8 text-center space-y-4">
          <p className="text-sm text-red-200">{error}</p>
          <button
            type="button"
            onClick={() => loadArchive(selectedLeagueId, true)}
            className="min-h-[42px] px-4 py-2 rounded-lg bg-[#22FF66] text-[#090B0E] text-xs font-semibold inline-flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>{t.common.retry}</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && groupedByDate.length === 0 && (
        <div className="rounded-2xl bg-[#12161B] border border-white/[0.07] p-8 text-center text-sm text-slate-400">
          {t.pastMatchesPage.emptyState}
        </div>
      )}

      {/* Date-Grouped Past Matches List */}
      {!loading && !error && groupedByDate.length > 0 && (
        <div className="space-y-5">
          {groupedByDate.map((group) => (
            <section
              key={group.date}
              className="rounded-2xl bg-[#12161B] border border-white/[0.07] overflow-hidden"
            >
              <div className="px-4 sm:px-5 py-3 border-b border-white/[0.06] bg-[#151A21] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 min-w-0">
                  <Calendar className="h-3.5 w-3.5 text-[#22FF66] shrink-0" />
                  <span className="truncate">{formatDateHeading(group.date, lang)}</span>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-slate-500 shrink-0">
                  {group.items.length}
                </span>
              </div>

              <div className="divide-y divide-white/[0.06]">
                {group.items.map((match) => {
                  const home = teamMap.get(match.homeTeamId);
                  const away = teamMap.get(match.awayTeamId);
                  const league = leagueMap.get(match.leagueId);
                  if (!home || !away) return null;

                  const hs = match.homeScore ?? 0;
                  const as = match.awayScore ?? 0;
                  const homeWon = hs > as;
                  const awayWon = as > hs;
                  const isFav = prefs.favoriteMatchIds.includes(match.id);

                  return (
                    <div
                      key={match.id}
                      className="px-3.5 sm:px-5 py-3.5 hover:bg-[#181D24] transition-colors flex items-center gap-2 sm:gap-4"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenPastMatch(match, archiveTeams)}
                        className="flex-1 min-w-0 text-start space-y-1.5"
                      >
                        {/* Quiet Metadata Line */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="font-mono text-[#22FF66]">
                            {league?.code ?? match.leagueId.toUpperCase()}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{localize(match.round)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{t.common.fullTime}</span>
                        </div>

                        {/* Scoreline Row */}
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
                          <div className="flex items-center justify-end gap-2 min-w-0">
                            <span
                              className={`text-xs sm:text-sm truncate text-end ${
                                homeWon ? 'font-bold text-white' : 'font-medium text-slate-300'
                              }`}
                            >
                              {localize(home.name)}
                            </span>
                            <TeamCrest team={home} size={24} className="w-5 h-5 sm:w-6 sm:h-6" />
                          </div>

                          <div
                            dir="ltr"
                            className="px-2.5 sm:px-3 py-1 rounded-md bg-[#090B0E] border border-white/[0.08] font-mono font-bold tabular-nums text-sm sm:text-base text-white whitespace-nowrap"
                          >
                            {hs} - {as}
                          </div>

                          <div className="flex items-center gap-2 min-w-0">
                            <TeamCrest team={away} size={24} className="w-5 h-5 sm:w-6 sm:h-6" />
                            <span
                              className={`text-xs sm:text-sm truncate ${
                                awayWon ? 'font-bold text-white' : 'font-medium text-slate-300'
                              }`}
                            >
                              {localize(away.name)}
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Action & Favorite Controls */}
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenPastMatch(match, archiveTeams)}
                          className="hidden md:inline-flex min-h-[36px] px-3 py-1.5 rounded-lg bg-[#090B0E] border border-white/[0.08] hover:border-[#22FF66]/50 text-xs font-medium text-slate-200 hover:text-[#22FF66] items-center gap-1.5 whitespace-nowrap transition-colors"
                        >
                          <span>{t.pastMatchesPage.fullReport}</span>
                          {isRtl ? (
                            <ChevronLeft className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleFavoriteMatch(match.id)}
                          aria-label={isFav ? t.common.favorited : t.common.favorite}
                          className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg transition-colors ${
                            isFav ? 'text-[#22FF66]' : 'text-slate-500 hover:text-slate-200'
                          }`}
                        >
                          <Star className={`h-4 w-4 ${isFav ? 'fill-[#22FF66]' : ''}`} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
