import React, { useMemo } from 'react';
import { Star } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { League, Match, Player, Team, UserPreferences } from '../types/football';
import { useLanguage } from '../i18n/LanguageContext';
import { TeamCrest } from '../components/ui/TeamCrest';
import { PlayerAvatar } from '../components/ui/PlayerAvatar';
import { MatchRow } from '../components/matches/MatchRow';

interface TeamsPageProps {
  leagues: League[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  selectedTeamId: string;
  prefs: UserPreferences;
  isDemoData?: boolean;
  onSelectTeam: (teamId: string) => void;
  onSelectPlayer: (playerId: string) => void;
  onOpenMatch: (matchId: string) => void;
  onToggleFavoriteTeam: (teamId: string) => void;
  onToggleFavoriteMatch: (matchId: string) => void;
}

export const TeamsPage: React.FC<TeamsPageProps> = ({
  leagues,
  teams,
  players,
  matches,
  selectedTeamId,
  prefs,
  isDemoData = true,
  onSelectTeam,
  onSelectPlayer,
  onOpenMatch,
  onToggleFavoriteTeam,
  onToggleFavoriteMatch,
}) => {
  const { t, lang, localize } = useLanguage();
  const team = teams.find((tm) => tm.id === selectedTeamId) ?? teams[0];
  const league = team ? leagues.find((lg) => lg.id === team.leagueId) : undefined;
  const teamMap = useMemo(() => new Map(teams.map((tm) => [tm.id, tm])), [teams]);

  const squadPlayers = useMemo(
    () => (team ? players.filter((p) => p.teamId === team.id) : []),
    [players, team]
  );

  const clubMatches = useMemo(
    () => (team ? matches.filter((m) => m.homeTeamId === team.id || m.awayTeamId === team.id) : []),
    [matches, team]
  );

  if (!team) return null;

  const isFollowed = prefs.favoriteTeamIds.includes(team.id);

  const metricsChartData = [
    { metric: 'GF', value: team.seasonStats.goalsFor },
    { metric: 'GA', value: team.seasonStats.goalsAgainst },
    { metric: 'PTS', value: team.seasonStats.points },
    { metric: 'CS', value: team.seasonStats.cleanSheets },
  ];

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-full min-w-0">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">{t.teamsPage.title}</h1>
        <p className="text-xs sm:text-sm text-slate-400">{t.teamsPage.subtitle}</p>
      </div>

      {/* Club Selector Strip */}
      <div className="w-full max-w-full flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {teams.map((tm) => {
          const active = tm.id === team.id;
          return (
            <button
              key={tm.id}
              type="button"
              onClick={() => onSelectTeam(tm.id)}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 whitespace-nowrap shrink-0 border transition-colors ${
                active
                  ? 'bg-[#181D24] border-[#22FF66] text-white font-semibold'
                  : 'bg-[#12161B] border-white/[0.07] text-slate-400 hover:text-white'
              }`}
            >
              <TeamCrest team={tm} size={20} />
              <span>{localize(tm.name)}</span>
            </button>
          );
        })}
      </div>

      {/* Team Hero Profile */}
      <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <TeamCrest team={team} size={60} className="w-12 h-12 sm:w-[60px] sm:h-[60px]" />
            <div className="min-w-0">
              <div className="text-xs text-slate-400 break-words">
                {league ? localize(league.name) : ''} · {localize(team.stadium)}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-0.5 break-words">
                {localize(team.name)}
              </h2>
              <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span>
                  {t.teamsPage.manager}: <span className="text-slate-200">{localize(team.manager)}</span>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t.teamsPage.formation}: <span className="font-mono text-[#22FF66]">{team.formation}</span>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onToggleFavoriteTeam(team.id)}
            className={`w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 border transition-colors whitespace-nowrap shrink-0 ${
              isFollowed
                ? 'bg-[#22FF66] text-[#090B0E] border-[#22FF66]'
                : 'bg-[#181D24] text-white border-white/[0.1] hover:border-[#22FF66]/60'
            }`}
          >
            <Star className={`h-4 w-4 ${isFollowed ? 'fill-[#090B0E]' : ''}`} />
            <span>{isFollowed ? t.teamsPage.followingClub : t.teamsPage.followClub}</span>
          </button>
        </div>

        {/* 4-Column Telemetry Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-4 sm:pt-5 border-t border-white/[0.06]">
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#090B0E] border border-white/[0.06]">
            <div className="text-[11px] sm:text-xs text-slate-400">
              {team.seasonStats.avgPossession > 0
                ? t.teamsPage.avgPossession
                : lang === 'fa'
                  ? 'امتیاز فصل'
                  : 'Season Points'}
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-white mt-1">
              {team.seasonStats.avgPossession > 0
                ? `${team.seasonStats.avgPossession.toFixed(1)}%`
                : team.seasonStats.points}
            </div>
          </div>
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#090B0E] border border-white/[0.06]">
            <div className="text-[11px] sm:text-xs text-slate-400">
              {lang === 'fa' ? 'میانگین گل زده' : 'Goals / Match'}
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-[#22FF66] mt-1">
              {team.seasonStats.avgXgFor.toFixed(2)}
            </div>
          </div>
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#090B0E] border border-white/[0.06]">
            <div className="text-[11px] sm:text-xs text-slate-400">
              {lang === 'fa' ? 'میانگین گل خورده' : 'Conceded / Match'}
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-sky-400 mt-1">
              {team.seasonStats.avgXgAgainst.toFixed(2)}
            </div>
          </div>
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#090B0E] border border-white/[0.06]">
            <div className="text-[11px] sm:text-xs text-slate-400">
              {lang === 'fa' ? 'تفاضل گل' : 'Goal Difference'}
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-white mt-1">
              {team.seasonStats.goalsFor - team.seasonStats.goalsAgainst >= 0 ? '+' : ''}
              {team.seasonStats.goalsFor - team.seasonStats.goalsAgainst}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Split: Season Output Chart + Squad & Fixtures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] p-4 sm:p-5 space-y-4 min-w-0 overflow-hidden">
          <h3 className="text-sm font-bold text-white">{t.teamsPage.squadLeaders}</h3>
          {squadPlayers.length === 0 ? (
            <p className="text-sm text-slate-400">{t.common.noResults}</p>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {squadPlayers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPlayer(p.id)}
                  className="w-full py-3 flex items-center justify-between gap-3 hover:bg-[#181D24] px-2 rounded-lg transition-colors text-start"
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
                        {p.shirtNumber > 0 ? `#${p.shirtNumber} ` : ''}
                        {localize(p.name)}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {p.position} · {p.stats.goals} {t.common.goals} · {p.stats.assists}{' '}
                        {t.common.assists}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono tabular-nums text-sm font-bold text-[#22FF66] shrink-0">
                    {p.rating.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-white/[0.06]" dir="ltr">
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metricsChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="metric" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#12161B',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#F1F5F9',
                    }}
                  />
                  <Bar dataKey="value" fill="#22FF66" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-bold text-white">{t.teamsPage.recentFixtures}</h3>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {clubMatches.map((m) => {
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
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
