import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Brain, Search } from 'lucide-react';
import type {
  AppScreen,
  League,
  Match,
  NewsArticle,
  StandingRow,
  Team,
  UserPreferences,
} from '../types/football';
import { useLanguage } from '../i18n/LanguageContext';
import { FeaturedMatchHero } from '../components/matches/FeaturedMatchHero';
import { DateStrip } from '../components/matches/DateStrip';
import { MatchRow } from '../components/matches/MatchRow';
import { TeamCrest } from '../components/ui/TeamCrest';
import { SafeImage } from '../components/ui/SafeImage';

interface HomePageProps {
  leagues: League[];
  teams: Team[];
  matches: Match[];
  news: NewsArticle[];
  standingsByLeague?: Record<string, StandingRow[]>;
  prefs: UserPreferences;
  isDemoData?: boolean;
  onOpenMatch: (matchId: string) => void;
  onOpenAiLab: (matchId?: string) => void;
  onNavigate: (screen: AppScreen) => void;
  onOpenLeagueTable?: (leagueId: string) => void;
  onSelectTeam: (teamId: string) => void;
  onToggleFavoriteMatch: (matchId: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  leagues,
  teams,
  matches,
  news,
  standingsByLeague,
  prefs,
  isDemoData = false,
  onOpenMatch,
  onOpenAiLab,
  onNavigate,
  onOpenLeagueTable,
  onSelectTeam,
  onToggleFavoriteMatch,
}) => {
  const { t, lang, localize } = useLanguage();
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [standingsLeagueId, setStandingsLeagueId] = useState<string>(leagues[0]?.id ?? 'epl');

  const teamMap = useMemo(() => new Map(teams.map((tm) => [tm.id, tm])), [teams]);
  const leagueMap = useMemo(() => new Map(leagues.map((lg) => [lg.id, lg])), [leagues]);

  const featuredMatch = useMemo(
    () => matches.find((m) => m.isFeatured) ?? matches[0],
    [matches]
  );

  const countsByDay = useMemo(() => {
    const counts: Record<number, number> = { [-1]: 0, 0: 0, 1: 0 };
    for (const m of matches) {
      counts[m.dayOffset] = (counts[m.dayOffset] ?? 0) + 1;
    }
    return counts;
  }, [matches]);

  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return matches.filter((m) => {
      if (m.dayOffset !== selectedDay) return false;
      if (selectedLeagueId !== 'all' && m.leagueId !== selectedLeagueId) return false;
      if (!q) return true;
      const home = teamMap.get(m.homeTeamId);
      const away = teamMap.get(m.awayTeamId);
      const league = leagueMap.get(m.leagueId);
      return (
        home?.name.en.toLowerCase().includes(q) ||
        home?.name.fa.includes(q) ||
        away?.name.en.toLowerCase().includes(q) ||
        away?.name.fa.includes(q) ||
        league?.name.en.toLowerCase().includes(q) ||
        league?.name.fa.includes(q)
      );
    });
  }, [matches, selectedDay, selectedLeagueId, searchQuery, teamMap, leagueMap]);

  const matchesByLeague = useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const m of filteredMatches) {
      const existing = groups.get(m.leagueId) ?? [];
      existing.push(m);
      groups.set(m.leagueId, existing);
    }
    return Array.from(groups.entries());
  }, [filteredMatches]);

  const activeStandingsLeagueId = leagueMap.has(standingsLeagueId)
    ? standingsLeagueId
    : (leagues[0]?.id ?? 'epl');

  const standingsRows = useMemo(() => {
    const dedicated = standingsByLeague?.[activeStandingsLeagueId];
    if (dedicated && dedicated.length > 0) {
      // If grouped (e.g., ACL West/East), preview the first region cleanly
      const firstGroup = dedicated[0]?.group;
      const scoped = firstGroup
        ? dedicated.filter((r) => r.group === firstGroup)
        : dedicated;
      return scoped.slice(0, 10);
    }

    return teams
      .filter((tm) => tm.leagueId === activeStandingsLeagueId)
      .sort((a, b) => {
        if (b.seasonStats.points !== a.seasonStats.points) {
          return b.seasonStats.points - a.seasonStats.points;
        }
        const gdB = b.seasonStats.goalsFor - b.seasonStats.goalsAgainst;
        const gdA = a.seasonStats.goalsFor - a.seasonStats.goalsAgainst;
        return gdB - gdA;
      })
      .slice(0, 10)
      .map((tm, idx): StandingRow => ({
        rank: idx + 1,
        teamId: tm.id,
        played: tm.seasonStats.played,
        won: tm.seasonStats.won,
        drawn: tm.seasonStats.drawn,
        lost: tm.seasonStats.lost,
        goalsFor: tm.seasonStats.goalsFor,
        goalsAgainst: tm.seasonStats.goalsAgainst,
        goalDiff: tm.seasonStats.goalsFor - tm.seasonStats.goalsAgainst,
        points: tm.seasonStats.points,
        goalsPerMatch: tm.seasonStats.avgXgFor,
        form: tm.form,
      }));
  }, [standingsByLeague, teams, activeStandingsLeagueId]);

  const featuredHome = featuredMatch ? teamMap.get(featuredMatch.homeTeamId) : undefined;
  const featuredAway = featuredMatch ? teamMap.get(featuredMatch.awayTeamId) : undefined;
  const featuredLeague = featuredMatch ? leagueMap.get(featuredMatch.leagueId) : undefined;

  return (
    <div className="space-y-6 sm:space-y-8 w-full max-w-full min-w-0">
      {/* Dominant Focal Anchor: Featured Match Spotlight */}
      {featuredMatch && featuredHome && featuredAway && featuredLeague && (
        <FeaturedMatchHero
          match={featuredMatch}
          league={featuredLeague}
          homeTeam={featuredHome}
          awayTeam={featuredAway}
          isDemoData={isDemoData}
          onOpenMatch={onOpenMatch}
          onOpenAiLab={(matchId) => onOpenAiLab(matchId)}
        />
      )}

      {/* Primary 2-Column Sports Dashboard Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start min-w-0">
        {/* Left/Main Column: Date Strip + Filters + League-Grouped Match Feed */}
        <div className="space-y-4 min-w-0 w-full max-w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-baseline gap-2 flex-wrap min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-white">{t.home.liveMatchesTitle}</h2>
              {isDemoData && (
                <span className="text-xs font-mono text-amber-300/90">
                  · {lang === 'fa' ? 'نمونه آزمایشی' : 'Demo Schedule'}
                </span>
              )}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.topBar.searchPlaceholder}
                className="w-full min-h-[42px] ps-9 pe-3 py-2 rounded-lg bg-[#12161B] border border-white/[0.07] text-sm text-white placeholder:text-slate-500 focus:border-[#22FF66]/60 focus:outline-none"
              />
            </div>
          </div>

          <DateStrip
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            countsByDay={countsByDay}
          />

          {/* Competition Filter Tabs */}
          <div className="w-full max-w-full flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => setSelectedLeagueId('all')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                selectedLeagueId === 'all'
                  ? 'bg-[#181D24] text-[#22FF66] border border-[#22FF66]/40'
                  : 'bg-[#12161B] text-slate-400 border border-white/[0.06] hover:text-white'
              }`}
            >
              {t.common.allLeagues}
            </button>
            {leagues.map((lg) => (
              <button
                key={lg.id}
                type="button"
                onClick={() => {
                  setSelectedLeagueId(lg.id);
                  setStandingsLeagueId(lg.id);
                }}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  selectedLeagueId === lg.id
                    ? 'bg-[#181D24] text-[#22FF66] border border-[#22FF66]/40'
                    : 'bg-[#12161B] text-slate-400 border border-white/[0.06] hover:text-white'
                }`}
              >
                {localize(lg.name)}
              </button>
            ))}
          </div>

          {/* Match Feed Grouped by Competition */}
          {matchesByLeague.length === 0 ? (
            <div className="rounded-xl bg-[#12161B] border border-white/[0.07] p-8 text-center space-y-3">
              <p className="text-sm text-slate-400">{t.common.noResults}</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedLeagueId('all');
                  setSearchQuery('');
                  setSelectedDay(0);
                }}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-[#181D24] text-xs font-medium text-white hover:bg-[#1E252E]"
              >
                {t.common.reset}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {matchesByLeague.map(([leagueId, leagueMatches]) => {
                const league = leagueMap.get(leagueId);
                if (!league) return null;
                return (
                  <div
                    key={leagueId}
                    className="rounded-xl bg-[#12161B] border border-white/[0.07] overflow-hidden"
                  >
                    <div className="px-3.5 sm:px-4 py-2.5 bg-[#151A21] border-b border-white/[0.06] flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 font-semibold text-slate-200 min-w-0">
                        <span className="font-mono text-[#22FF66] shrink-0">{league.code}</span>
                        <span className="truncate">{localize(league.name)}</span>
                        <span aria-hidden="true" className="hidden sm:inline text-slate-600 shrink-0">·</span>
                        <span className="hidden sm:inline font-normal text-slate-400 truncate">{localize(league.country)}</span>
                      </div>
                      <span className="font-mono tabular-nums text-slate-500 shrink-0">{league.season}</span>
                    </div>

                    <div className="divide-y divide-white/[0.06]">
                      {leagueMatches.map((m) => {
                        const home = teamMap.get(m.homeTeamId);
                        const away = teamMap.get(m.awayTeamId);
                        if (!home || !away) return null;
                        return (
                          <MatchRow
                            key={m.id}
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
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right/Secondary Column: Standings Snapshot + AI Football Lab Callout */}
        <div className="space-y-6 min-w-0 w-full max-w-full">
          {/* Quick Standings Widget */}
          <section className="rounded-xl bg-[#12161B] border border-white/[0.07] overflow-hidden">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white truncate">
                  {t.home.standingsPreview}
                </h3>
                {leagueMap.get(activeStandingsLeagueId) && (
                  <p className="text-[11px] text-[#22FF66] truncate mt-0.5">
                    {localize(leagueMap.get(activeStandingsLeagueId)!.name)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  onOpenLeagueTable
                    ? onOpenLeagueTable(activeStandingsLeagueId)
                    : onNavigate('leagues')
                }
                className="text-xs text-[#22FF66] hover:underline whitespace-nowrap shrink-0"
              >
                {t.home.viewFullTable}
              </button>
            </div>

            <div className="px-3.5 sm:px-4 pt-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {leagues.map((lg) => {
                const active = activeStandingsLeagueId === lg.id;
                return (
                  <button
                    key={lg.id}
                    type="button"
                    onClick={() => setStandingsLeagueId(lg.id)}
                    className={`min-h-[34px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 border ${
                      active
                        ? 'bg-[#22FF66] text-[#090B0E] border-[#22FF66] font-semibold'
                        : 'bg-[#181D24]/60 text-slate-400 border-white/[0.06] hover:text-white'
                    }`}
                  >
                    {lg.code}
                  </button>
                );
              })}
            </div>

            <div className="p-3.5 sm:p-4 pt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-white/[0.06]">
                    <th className="py-2 text-start font-medium w-6">#</th>
                    <th className="py-2 text-start font-medium">{t.nav.teams}</th>
                    <th className="py-2 text-end font-medium">{t.common.played}</th>
                    <th className="py-2 text-end font-medium">{t.common.goalDiff}</th>
                    <th className="py-2 text-end font-semibold text-slate-300">{t.common.points}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {standingsRows.map((row) => {
                    const tm = teamMap.get(row.teamId);
                    if (!tm) return null;
                    return (
                      <tr
                        key={`${activeStandingsLeagueId}-${row.teamId}`}
                        onClick={() => onSelectTeam(tm.id)}
                        className="hover:bg-[#181D24] cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 font-mono tabular-nums text-slate-400">
                          {row.rank}
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <TeamCrest team={tm} size={20} />
                            <span className="font-medium text-slate-200 truncate">
                              {localize(tm.name)}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 text-end font-mono tabular-nums text-slate-400">
                          {row.played}
                        </td>
                        <td className="py-2.5 text-end font-mono tabular-nums text-slate-400">
                          {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                        </td>
                        <td className="py-2.5 text-end font-mono tabular-nums font-bold text-white">
                          {row.points}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* AI Football Lab Surface */}
          <section className="rounded-xl bg-[#12161B] border border-white/[0.07] p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <Brain className="h-5 w-5 text-[#22FF66] shrink-0" />
              <h3 className="text-base font-bold text-white">{t.home.aiLabBannerTitle}</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              {t.home.aiLabBannerDesc}
            </p>
            <button
              type="button"
              onClick={() => onOpenAiLab()}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#181D24] border border-[#22FF66]/40 text-[#22FF66] text-sm font-semibold hover:bg-[#22FF66] hover:text-[#090B0E] transition-colors flex items-center justify-center gap-2"
            >
              <span>{t.home.openLabCta}</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </section>
        </div>
      </div>

      {/* Editorial & Tactical Briefings Row */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">{t.home.trendingNews}</h2>
          <button
            type="button"
            onClick={() => onNavigate('news')}
            className="text-xs font-medium text-[#22FF66] hover:underline"
          >
            {t.home.viewAllNews}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {news.slice(0, 3).map((article) => (
            <article
              key={article.id}
              onClick={() => onNavigate('news')}
              className="group cursor-pointer rounded-xl bg-[#12161B] border border-white/[0.07] overflow-hidden flex flex-col hover:border-white/[0.16] transition-colors"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-[#090B0E]">
                <SafeImage
                  src={article.imageUrl}
                  alt={localize(article.title)}
                  fallbackLabel={localize(article.title)}
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                />
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  {/* Unboxed metadata with separators */}
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="text-[#22FF66] font-medium">
                      {t.newsPage[article.category]}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{article.publishedAt}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {article.readTimeMin} {t.common.minRead}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-white leading-snug group-hover:text-[#22FF66] transition-colors">
                    {localize(article.title)}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                    {localize(article.summary)}
                  </p>
                </div>
                <div className="text-xs text-slate-500 pt-2 border-t border-white/[0.05]">
                  {localize(article.author)}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
