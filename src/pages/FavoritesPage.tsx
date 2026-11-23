import React, { useMemo } from 'react';
import { Star } from 'lucide-react';
import type { AppScreen, Match, Player, Team, UserPreferences } from '../types/football';
import { useLanguage } from '../i18n/LanguageContext';
import { TeamCrest } from '../components/ui/TeamCrest';
import { PlayerAvatar } from '../components/ui/PlayerAvatar';
import { MatchRow } from '../components/matches/MatchRow';

interface FavoritesPageProps {
  teams: Team[];
  matches: Match[];
  players: Player[];
  prefs: UserPreferences;
  isDemoData?: boolean;
  onSelectTeam: (teamId: string) => void;
  onSelectPlayer: (playerId: string) => void;
  onOpenMatch: (matchId: string) => void;
  onToggleFavoriteTeam: (teamId: string) => void;
  onToggleFavoriteMatch: (matchId: string) => void;
  onToggleFavoritePlayer: (playerId: string) => void;
  onNavigate: (screen: AppScreen) => void;
}

export const FavoritesPage: React.FC<FavoritesPageProps> = ({
  teams,
  matches,
  players,
  prefs,
  isDemoData = true,
  onSelectTeam,
  onSelectPlayer,
  onOpenMatch,
  onToggleFavoriteTeam,
  onToggleFavoriteMatch,
  onToggleFavoritePlayer,
  onNavigate,
}) => {
  const { t, localize } = useLanguage();
  const teamMap = useMemo(() => new Map(teams.map((tm) => [tm.id, tm])), [teams]);

  const favTeams = teams.filter((tm) => prefs.favoriteTeamIds.includes(tm.id));
  const favMatches = matches.filter((m) => prefs.favoriteMatchIds.includes(m.id));
  const favPlayers = players.filter((p) => prefs.favoritePlayerIds.includes(p.id));

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-full min-w-0">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">{t.favoritesPage.title}</h1>
        <p className="text-xs sm:text-sm text-slate-400">{t.favoritesPage.subtitle}</p>
      </div>

      {/* Followed Clubs */}
      <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] p-4 sm:p-5 space-y-4">
        <h2 className="text-base font-bold text-white">{t.favoritesPage.teams}</h2>
        {favTeams.length === 0 ? (
          <p className="text-sm text-slate-400">{t.favoritesPage.emptyTeams}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {favTeams.map((tm) => (
              <div
                key={tm.id}
                className="p-3.5 rounded-xl bg-[#090B0E] border border-white/[0.06] flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => onSelectTeam(tm.id)}
                  className="flex items-center gap-3 min-w-0 text-start flex-1"
                >
                  <TeamCrest team={tm} size={32} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {localize(tm.name)}
                    </div>
                    <div className="text-xs font-mono tabular-nums text-slate-400">
                      {tm.seasonStats.points} {t.common.points} · {tm.formation}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleFavoriteTeam(tm.id)}
                  aria-label={t.common.favorited}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#22FF66]"
                >
                  <Star className="h-4 w-4 fill-[#22FF66]" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Saved Matches */}
      <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/[0.06] flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-white">{t.favoritesPage.matches}</h2>
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="text-xs font-medium text-[#22FF66] hover:underline whitespace-nowrap shrink-0"
          >
            {t.favoritesPage.exploreHome}
          </button>
        </div>
        {favMatches.length === 0 ? (
          <p className="p-4 sm:p-5 text-sm text-slate-400">{t.favoritesPage.emptyMatches}</p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {favMatches.map((m) => {
              const home = teamMap.get(m.homeTeamId);
              const away = teamMap.get(m.awayTeamId);
              if (!home || !away) return null;
              return (
                <MatchRow
                  key={m.id}
                  match={m}
                  homeTeam={home}
                  awayTeam={away}
                  isFavorite
                  showXg={prefs.showXgOnCards}
                  isDemoData={isDemoData}
                  onSelect={onOpenMatch}
                  onToggleFavorite={onToggleFavoriteMatch}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Tracked Players */}
      <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] p-4 sm:p-5 space-y-4">
        <h2 className="text-base font-bold text-white">{t.favoritesPage.players}</h2>
        {favPlayers.length === 0 ? (
          <p className="text-sm text-slate-400">{t.favoritesPage.emptyPlayers}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {favPlayers.map((p) => {
              const tm = teamMap.get(p.teamId);
              return (
                <div
                  key={p.id}
                  className="p-3.5 rounded-xl bg-[#090B0E] border border-white/[0.06] flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => onSelectPlayer(p.id)}
                    className="flex items-center gap-3 min-w-0 text-start flex-1"
                  >
                    <PlayerAvatar
                      name={localize(p.name)}
                      photoUrl={p.photoUrl}
                      shirtNumber={p.shirtNumber}
                      size={36}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {localize(p.name)}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {tm ? localize(tm.name) : ''} ·{' '}
                        <span className="font-mono tabular-nums text-[#22FF66]">
                          {p.rating.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleFavoritePlayer(p.id)}
                    aria-label={t.common.favorited}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#22FF66]"
                  >
                    <Star className="h-4 w-4 fill-[#22FF66]" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
