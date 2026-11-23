import React, { useMemo } from 'react';
import { Brain, Star } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Player, Team, UserPreferences } from '../types/football';
import { useLanguage } from '../i18n/LanguageContext';
import { TeamCrest } from '../components/ui/TeamCrest';
import { PlayerAvatar } from '../components/ui/PlayerAvatar';

interface PlayersPageProps {
  players: Player[];
  teams: Team[];
  selectedPlayerId: string;
  prefs: UserPreferences;
  onSelectPlayer: (playerId: string) => void;
  onToggleFavoritePlayer: (playerId: string) => void;
  onCompareInAi: (playerId: string) => void;
}

export const PlayersPage: React.FC<PlayersPageProps> = ({
  players,
  teams,
  selectedPlayerId,
  prefs,
  onSelectPlayer,
  onToggleFavoritePlayer,
  onCompareInAi,
}) => {
  const { t, localize } = useLanguage();
  const teamMap = useMemo(() => new Map(teams.map((tm) => [tm.id, tm])), [teams]);
  const player = players.find((p) => p.id === selectedPlayerId) ?? players[0];
  if (!player) return null;
  const team = teamMap.get(player.teamId);
  const isFav = prefs.favoritePlayerIds.includes(player.id);

  const radarData = [
    { attr: 'PAC', value: player.radar.pace },
    { attr: 'SHO', value: player.radar.shooting },
    { attr: 'PAS', value: player.radar.passing },
    { attr: 'DRI', value: player.radar.dribbling },
    { attr: 'DEF', value: player.radar.defending },
    { attr: 'PHY', value: player.radar.physical },
  ];

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-full min-w-0">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">{t.playersPage.title}</h1>
        <p className="text-xs sm:text-sm text-slate-400">{t.playersPage.subtitle}</p>
      </div>

      {/* Player Selector Strip */}
      <div className="w-full max-w-full flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {players.map((p) => {
          const active = p.id === player.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPlayer(p.id)}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 whitespace-nowrap shrink-0 border transition-colors ${
                active
                  ? 'bg-[#22FF66] text-[#090B0E] border-[#22FF66] font-semibold'
                  : 'bg-[#12161B] text-slate-300 border-white/[0.07] hover:text-white'
              }`}
            >
              <PlayerAvatar
                name={localize(p.name)}
                photoUrl={p.photoUrl}
                shirtNumber={p.shirtNumber}
                size={24}
                accent={active ? 'neutral' : 'neutral'}
                className={active ? 'border-[#090B0E]/30' : ''}
              />
              {p.shirtNumber > 0 && (
                <span className="font-mono tabular-nums opacity-75">#{p.shirtNumber}</span>
              )}
              <span>{localize(p.name)}</span>
            </button>
          );
        })}
      </div>

      {/* Player Hero Card */}
      <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <div className="relative shrink-0">
              <PlayerAvatar
                name={localize(player.name)}
                photoUrl={player.photoUrl}
                shirtNumber={player.shirtNumber}
                position={player.position}
                size={72}
                rounded="2xl"
                accent="home"
                className="w-16 h-16 sm:w-[76px] sm:h-[76px]"
              />
              <span className="absolute -bottom-1.5 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 px-1.5 py-0.5 rounded bg-[#090B0E] border border-[#22FF66]/45 text-[10px] font-mono font-bold tabular-nums text-[#22FF66] whitespace-nowrap shadow">
                {player.shirtNumber > 0 ? `#${player.shirtNumber} · ${player.position}` : player.position}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
                {team && <TeamCrest team={team} size={18} />}
                <span className="truncate">{team ? localize(team.name) : ''}</span>
                <span aria-hidden="true">·</span>
                <span>{localize(player.nationality)}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">Age {player.age}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-1 break-words">
                {localize(player.name)}
              </h2>
              {player.marketValueEurM > 0 && (
                <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>
                    {t.playersPage.marketValue}:{' '}
                    <strong className="font-mono text-slate-200">€{player.marketValueEurM}M</strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t.playersPage.preferredFoot}:{' '}
                    <strong className="text-slate-200">{player.preferredFoot}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full md:w-auto">
            <button
              type="button"
              onClick={() => onCompareInAi(player.id)}
              className="min-h-[44px] px-3 sm:px-4 py-2 rounded-lg bg-[#22FF66] text-[#090B0E] text-xs sm:text-sm font-semibold hover:bg-[#3bff77] inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap min-w-0"
            >
              <Brain className="h-4 w-4 shrink-0" />
              <span className="truncate">{t.playersPage.compareInAi}</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleFavoritePlayer(player.id)}
              className={`min-h-[44px] px-3 sm:px-3.5 py-2 rounded-lg border text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap min-w-0 ${
                isFav
                  ? 'bg-[#22FF66]/10 border-[#22FF66]/40 text-[#22FF66]'
                  : 'bg-[#181D24] border-white/[0.1] text-slate-300 hover:text-white'
              }`}
            >
              <Star className={`h-4 w-4 shrink-0 ${isFav ? 'fill-[#22FF66]' : ''}`} />
              <span className="truncate">{isFav ? t.common.favorited : t.common.favorite}</span>
            </button>
          </div>
        </div>

        {/* Season Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-5 border-t border-white/[0.06]">
          {[
            { label: t.common.rating, val: player.rating.toFixed(2), accent: true },
            { label: t.playersPage.appearances, val: String(player.stats.appearances) },
            { label: t.common.goals, val: String(player.stats.goals) },
            { label: t.common.assists, val: String(player.stats.assists) },
            { label: t.common.xG, val: player.stats.xG.toFixed(1) },
            { label: t.common.passAccuracy, val: `${player.stats.passAccuracy.toFixed(1)}%` },
          ].map((stat) => (
            <div key={stat.label} className="p-3.5 rounded-xl bg-[#090B0E] border border-white/[0.06]">
              <div className="text-[11px] text-slate-400">{stat.label}</div>
              <div
                className={`text-xl font-mono font-bold tabular-nums mt-1 ${
                  stat.accent ? 'text-[#22FF66]' : 'text-white'
                }`}
              >
                {stat.val}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Charts Row: Attribute Radar + Recent Rating Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 min-w-0" dir="ltr">
        <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] p-4 sm:p-5 space-y-3 min-w-0 overflow-hidden">
          <h3 className="text-sm font-bold text-white">{t.playersPage.attributeRadar}</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="attr" tick={{ fill: '#CBD5E1', fontSize: 12 }} />
                <Radar
                  name={player.name.en}
                  dataKey="value"
                  stroke="#22FF66"
                  fill="#22FF66"
                  fillOpacity={0.22}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#12161B',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#F1F5F9',
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] p-4 sm:p-5 space-y-3 min-w-0 overflow-hidden">
          <h3 className="text-sm font-bold text-white">{t.playersPage.recentRatingTrend}</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={player.recentRatings}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="matchLabel" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[6, 10]} tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#12161B',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#F1F5F9',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="rating"
                  stroke="#22FF66"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#090B0E', stroke: '#22FF66', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
};
