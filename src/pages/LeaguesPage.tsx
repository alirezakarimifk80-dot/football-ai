import React, { useMemo, useState } from 'react';
import type { League, Match, Player, StandingRow, Team, UserPreferences } from '../types/football';
import { useLanguage } from '../i18n/LanguageContext';
import { TeamCrest } from '../components/ui/TeamCrest';
import { PlayerAvatar } from '../components/ui/PlayerAvatar';
import { MatchRow } from '../components/matches/MatchRow';

interface LeaguesPageProps {
  leagues: League[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  standingsByLeague?: Record<string, StandingRow[]>;
  selectedLeagueId?: string;
  onSelectLeague?: (leagueId: string) => void;
  prefs: UserPreferences;
  isDemoData?: boolean;
  onSelectTeam: (teamId: string) => void;
  onSelectPlayer: (playerId: string) => void;
  onOpenMatch: (matchId: string) => void;
  onToggleFavoriteMatch: (matchId: string) => void;
}

function localizeGroupLabel(group: string, lang: 'en' | 'fa'): string {
  if (lang !== 'fa') return group;
  const lower = group.toLowerCase();
  if (lower.includes('west')) return 'منطقه غرب';
  if (lower.includes('east')) return 'منطقه شرق';
  return group;
}

export const LeaguesPage: React.FC<LeaguesPageProps> = ({
  leagues,
  teams,
  players,
  matches,
  standingsByLeague,
  selectedLeagueId: controlledLeagueId,
  onSelectLeague,
  prefs,
  isDemoData = false,
  onSelectTeam,
  onSelectPlayer,
  onOpenMatch,
  onToggleFavoriteMatch,
}) => {
  const { t, lang, localize } = useLanguage();
  const [internalLeagueId, setInternalLeagueId] = useState(
    controlledLeagueId ?? leagues[0]?.id ?? 'epl'
  );
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  const activeLeagueId =
    controlledLeagueId && leagues.some((l) => l.id === controlledLeagueId)
      ? controlledLeagueId
      : leagues.some((l) => l.id === internalLeagueId)
        ? internalLeagueId
        : (leagues[0]?.id ?? 'epl');

  const handleSelectLeague = (leagueId: string) => {
    setInternalLeagueId(leagueId);
    setSelectedGroup('');
    onSelectLeague?.(leagueId);
  };

  const teamMap = useMemo(() => new Map(teams.map((tm) => [tm.id, tm])), [teams]);
  const selectedLeague = leagues.find((l) => l.id === activeLeagueId) ?? leagues[0];

  const allLeagueRows = useMemo<StandingRow[]>(() => {
    const dedicated = standingsByLeague?.[activeLeagueId];
    if (dedicated && dedicated.length > 0) {
      return dedicated;
    }
    return teams
      .filter((tm) => tm.leagueId === activeLeagueId)
      .sort((a, b) => {
        if (b.seasonStats.points !== a.seasonStats.points) {
          return b.seasonStats.points - a.seasonStats.points;
        }
        return (
          b.seasonStats.goalsFor -
          b.seasonStats.goalsAgainst -
          (a.seasonStats.goalsFor - a.seasonStats.goalsAgainst)
        );
      })
      .map((tm, idx) => ({
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
  }, [standingsByLeague, teams, activeLeagueId]);

  const groups = useMemo(() => {
    const seen = new Set<string>();
    for (const row of allLeagueRows) {
      if (row.group) seen.add(row.group);
    }
    return Array.from(seen);
  }, [allLeagueRows]);

  const activeGroup =
    groups.length > 1
      ? groups.includes(selectedGroup)
        ? selectedGroup
        : groups[0]
      : '';

  const visibleRows = useMemo(() => {
    if (!activeGroup) return allLeagueRows;
    return allLeagueRows.filter((row) => row.group === activeGroup);
  }, [allLeagueRows, activeGroup]);

  const leagueTeamIds = useMemo(
    () => new Set(allLeagueRows.map((row) => row.teamId)),
    [allLeagueRows]
  );

  const [leaderboardMode, setLeaderboardMode] = useState<'rating' | 'scorers' | 'assists'>('rating');

  const leaguePlayers = useMemo(() => {
    return players
      .filter((p) => leagueTeamIds.has(p.teamId))
      .sort((a, b) => {
        if (leaderboardMode === 'scorers') return b.stats.goals - a.stats.goals;
        if (leaderboardMode === 'assists') return b.stats.assists - a.stats.assists;
        return b.rating - a.rating;
      });
  }, [players, leagueTeamIds, leaderboardMode]);

  const leagueMatches = useMemo(
    () => matches.filter((m) => m.leagueId === activeLeagueId),
    [matches, activeLeagueId]
  );

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-full min-w-0">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">{t.leaguesPage.title}</h1>
        <p className="text-xs sm:text-sm text-slate-400">{t.leaguesPage.subtitle}</p>
      </div>

      {/* League Selector Bar */}
      <div className="w-full max-w-full flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {leagues.map((lg) => {
          const active = lg.id === activeLeagueId;
          return (
            <button
              key={lg.id}
              type="button"
              onClick={() => handleSelectLeague(lg.id)}
              className={`min-h-[44px] px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 border ${
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

      {/* Standings Table */}
      <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm sm:text-base font-bold text-white truncate">
            {selectedLeague ? localize(selectedLeague.name) : ''} · {t.leaguesPage.standings}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            {groups.length > 1 && (
              <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-[#090B0E] border border-white/[0.06]">
                {groups.map((grp) => (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => setSelectedGroup(grp)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                      activeGroup === grp
                        ? 'bg-[#22FF66] text-[#090B0E] font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {localizeGroupLabel(grp, lang)}
                  </button>
                ))}
              </div>
            )}
            <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
              {selectedLeague?.season}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="text-[11px] sm:text-xs text-slate-500 border-b border-white/[0.06] bg-[#151A21]">
                <th className="py-2.5 sm:py-3 ps-3.5 sm:ps-5 pe-1.5 sm:pe-2 text-start font-medium w-8 sm:w-10">#</th>
                <th className="py-2.5 sm:py-3 px-1.5 sm:px-2 text-start font-medium">{t.nav.teams}</th>
                <th className="py-2.5 sm:py-3 px-1.5 sm:px-2 text-end font-medium">{t.common.played}</th>
                <th className="py-2.5 sm:py-3 px-2 text-end font-medium hidden sm:table-cell">{t.common.won}</th>
                <th className="py-2.5 sm:py-3 px-2 text-end font-medium hidden sm:table-cell">{t.common.drawn}</th>
                <th className="py-2.5 sm:py-3 px-2 text-end font-medium hidden sm:table-cell">{t.common.lost}</th>
                <th className="py-2.5 sm:py-3 px-1.5 sm:px-2 text-end font-medium">{t.common.goalDiff}</th>
                <th className="py-2.5 sm:py-3 px-2 text-end font-medium hidden md:table-cell">
                  {lang === 'fa' ? 'گل/بازی' : 'G/M'}
                </th>
                <th className="py-2.5 sm:py-3 px-2 text-center font-medium hidden md:table-cell">
                  {t.common.form}
                </th>
                <th className="py-2.5 sm:py-3 ps-1.5 sm:ps-2 pe-3.5 sm:pe-5 text-end font-semibold text-white">
                  {t.common.points}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {visibleRows.map((row) => {
                const tm = teamMap.get(row.teamId);
                if (!tm) return null;
                return (
                  <tr
                    key={`${activeLeagueId}-${row.group ?? 'all'}-${row.teamId}`}
                    onClick={() => onSelectTeam(tm.id)}
                    className="hover:bg-[#181D24] cursor-pointer transition-colors"
                  >
                    <td className="py-3 sm:py-3.5 ps-3.5 sm:ps-5 pe-1.5 sm:pe-2 font-mono tabular-nums text-slate-400">
                      {row.rank}
                    </td>
                    <td className="py-3 sm:py-3.5 px-1.5 sm:px-2">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <TeamCrest team={tm} size={24} className="w-5 h-5 sm:w-[26px] sm:h-[26px]" />
                        <span className="font-semibold text-white truncate max-w-[140px] sm:max-w-none">
                          {localize(tm.name)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 sm:py-3.5 px-1.5 sm:px-2 text-end font-mono tabular-nums text-slate-300">
                      {row.played}
                    </td>
                    <td className="py-3 sm:py-3.5 px-2 text-end font-mono tabular-nums text-slate-400 hidden sm:table-cell">
                      {row.won}
                    </td>
                    <td className="py-3 sm:py-3.5 px-2 text-end font-mono tabular-nums text-slate-400 hidden sm:table-cell">
                      {row.drawn}
                    </td>
                    <td className="py-3 sm:py-3.5 px-2 text-end font-mono tabular-nums text-slate-400 hidden sm:table-cell">
                      {row.lost}
                    </td>
                    <td className="py-3 sm:py-3.5 px-1.5 sm:px-2 text-end font-mono tabular-nums text-slate-300">
                      {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                    </td>
                    <td className="py-3 sm:py-3.5 px-2 text-end font-mono tabular-nums text-slate-400 hidden md:table-cell">
                      {row.goalsPerMatch.toFixed(2)}
                    </td>
                    <td className="py-3 sm:py-3.5 px-2 hidden md:table-cell">
                      <div className="flex items-center justify-center gap-1 font-mono text-xs font-semibold">
                        {row.form.length > 0 ? (
                          row.form.map((f, idx) => (
                            <span
                              key={idx}
                              className={`w-5 h-5 rounded flex items-center justify-center ${
                                f === 'W'
                                  ? 'bg-[#22FF66]/15 text-[#22FF66]'
                                  : f === 'D'
                                    ? 'bg-slate-700/60 text-slate-300'
                                    : 'bg-red-500/15 text-red-400'
                              }`}
                            >
                              {f}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 sm:py-3.5 ps-1.5 sm:ps-2 pe-3.5 sm:pe-5 text-end font-mono tabular-nums font-bold text-[#22FF66]">
                      {row.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom Grid: League Fixtures & Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-bold text-white">{t.leaguesPage.fixtures}</h3>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {leagueMatches.length === 0 ? (
              <p className="p-4 sm:p-5 text-sm text-slate-400">{t.common.noResults}</p>
            ) : (
              leagueMatches.map((m) => {
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
                    isDemoData={isDemoData}
                    onSelect={onOpenMatch}
                    onToggleFavorite={onToggleFavoriteMatch}
                  />
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white">{t.leaguesPage.topPerformers}</h3>
            <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-[#090B0E] border border-white/[0.06]">
              {(
                [
                  { id: 'rating', label: t.common.rating },
                  { id: 'scorers', label: t.common.goals },
                  { id: 'assists', label: t.common.assists },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLeaderboardMode(tab.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    leaderboardMode === tab.id
                      ? 'bg-[#22FF66] text-[#090B0E] font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {leaguePlayers.length === 0 ? (
              <p className="p-4 sm:p-5 text-sm text-slate-400">{t.common.noResults}</p>
            ) : (
              leaguePlayers.map((p) => {
                const tm = teamMap.get(p.teamId);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectPlayer(p.id)}
                    className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 sm:gap-4 hover:bg-[#181D24] transition-colors text-start"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PlayerAvatar
                        name={localize(p.name)}
                        photoUrl={p.photoUrl}
                        shirtNumber={p.shirtNumber}
                        size={38}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {localize(p.name)}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 truncate">
                          {tm ? localize(tm.name) : ''} · {p.position} · {p.stats.goals} {t.common.goals} ·{' '}
                          {p.stats.assists} {t.common.assists}
                        </div>
                      </div>
                    </div>
                    <div className="font-mono tabular-nums text-sm font-bold text-[#22FF66] shrink-0">
                      {p.rating.toFixed(2)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
