import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Award } from 'lucide-react';
import type { LineupPlayer, PlayerOfTheMatch } from '../../types/football';
import { useLanguage } from '../../i18n/LanguageContext';
import { PlayerAvatar } from './PlayerAvatar';

interface PitchFormationProps {
  homeName: string;
  awayName: string;
  homeFormation: string;
  awayFormation: string;
  homeXI: LineupPlayer[];
  awayXI: LineupPlayer[];
  homeSubs?: LineupPlayer[];
  awaySubs?: LineupPlayer[];
  playerOfTheMatch?: PlayerOfTheMatch;
}

function ratingBadgeTone(rating: number, isMotm?: boolean): string {
  if (isMotm || rating >= 8.2) {
    return 'bg-[#22FF66] text-[#090B0E] font-bold';
  }
  if (rating >= 7.2) {
    return 'bg-sky-400/20 text-sky-300 border border-sky-400/35 font-semibold';
  }
  if (rating >= 6.4) {
    return 'bg-white/[0.08] text-slate-200 border border-white/[0.1] font-medium';
  }
  return 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium';
}

export const PitchFormation: React.FC<PitchFormationProps> = ({
  homeName,
  awayName,
  homeFormation,
  awayFormation,
  homeXI,
  awayXI,
  homeSubs = [],
  awaySubs = [],
  playerOfTheMatch,
}) => {
  const { t, lang, localize } = useLanguage();
  const [selectedSide, setSelectedSide] = useState<'home' | 'away'>('home');
  const activeXI = selectedSide === 'home' ? homeXI : awayXI;

  if (homeXI.length === 0 && awayXI.length === 0) {
    return (
      <div className="rounded-xl bg-[#090B0E] border border-white/[0.06] p-8 text-center text-sm text-slate-400">
        {lang === 'fa'
          ? 'ترکیب اصلی رسمی هنوز منتشر نشده است (معمولاً ۶۰ دقیقه پیش از شروع مسابقه اعلام می‌شود).'
          : 'Official starting XI lineups are not published yet (typically announced ~60 minutes before kickoff).'}
      </div>
    );
  }

  const renderRosterColumn = (
    title: string,
    formation: string,
    starters: LineupPlayer[],
    subs: LineupPlayer[],
    side: 'home' | 'away'
  ) => {
    const playedSubs = subs.filter((s) => s.rating > 0 || s.subMinute);
    const unusedSubs = subs.filter((s) => !(s.rating > 0 || s.subMinute));
    const orderedSubs = [...playedSubs, ...unusedSubs];

    return (
      <div className="rounded-xl bg-[#090B0E] border border-white/[0.06] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between gap-2">
          <span
            className={`text-sm font-bold truncate ${
              side === 'home' ? 'text-[#22FF66]' : 'text-sky-400'
            }`}
          >
            {title}
          </span>
          <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
            {formation}
          </span>
        </div>

        {/* Starting XI Rows */}
        <div className="divide-y divide-white/[0.05]">
          {starters.map((p, idx) => (
            <div
              key={`${side}-xi-${p.number}-${idx}`}
              className="px-3.5 py-2.5 flex items-center justify-between gap-2.5 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <PlayerAvatar
                  name={localize(p.name)}
                  photoUrl={p.photoUrl}
                  shirtNumber={p.number}
                  size={34}
                  accent={side}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {p.number > 0 && (
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 shrink-0">
                        #{p.number}
                      </span>
                    )}
                    <span className="text-xs sm:text-sm font-semibold text-white truncate">
                      {localize(p.name)}
                    </span>
                    {p.isManOfTheMatch && (
                      <Award
                        className="h-3.5 w-3.5 text-[#22FF66] shrink-0"
                        aria-label={t.matchCenter.manOfTheMatch}
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400 mt-0.5">
                    <span className="font-mono">{p.position}</span>
                    {p.goals && p.goals > 0 ? (
                      <span className="text-[#22FF66] font-medium">
                        {lang === 'fa' ? `${p.goals} گل` : `${p.goals}G`}
                      </span>
                    ) : null}
                    {p.assists && p.assists > 0 ? (
                      <span className="text-sky-400 font-medium">
                        {lang === 'fa' ? `${p.assists} پاس گل` : `${p.assists}A`}
                      </span>
                    ) : null}
                    {p.yellowCard && (
                      <span className="text-amber-400 font-medium">
                        {lang === 'fa' ? 'کارت زرد' : 'YC'}
                      </span>
                    )}
                    {p.redCard && (
                      <span className="text-red-400 font-medium">
                        {lang === 'fa' ? 'کارت قرمز' : 'RC'}
                      </span>
                    )}
                    {p.subMinute && (
                      <span className="inline-flex items-center gap-0.5 text-slate-400 font-mono tabular-nums">
                        <ArrowDownLeft className="h-3 w-3 text-red-400" />
                        {p.subMinute}&apos;
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {p.rating > 0 ? (
                <span
                  className={`min-w-[38px] px-2 py-0.5 rounded text-center text-xs font-mono tabular-nums shrink-0 ${ratingBadgeTone(
                    p.rating,
                    p.isManOfTheMatch
                  )}`}
                >
                  {p.rating.toFixed(1)}
                </span>
              ) : (
                <span className="text-xs font-mono text-slate-600 shrink-0">—</span>
              )}
            </div>
          ))}
        </div>

        {/* Substitutes Section */}
        {orderedSubs.length > 0 && (
          <div className="border-t border-white/[0.08]">
            <div className="px-4 py-2 bg-[#12161B] text-[11px] font-semibold text-slate-400">
              {t.matchCenter.substitutes}
            </div>
            <div className="divide-y divide-white/[0.04]">
              {orderedSubs.map((p, idx) => (
                <div
                  key={`${side}-sub-${p.number}-${idx}`}
                  className="px-3.5 py-2 flex items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PlayerAvatar
                      name={localize(p.name)}
                      photoUrl={p.photoUrl}
                      shirtNumber={p.number}
                      size={30}
                      accent="neutral"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {p.number > 0 && (
                          <span className="text-[11px] font-mono tabular-nums text-slate-500 shrink-0">
                            #{p.number}
                          </span>
                        )}
                        <span className="text-xs font-medium text-slate-200 truncate">
                          {localize(p.name)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                        <span className="font-mono">{p.position}</span>
                        {p.subMinute && (
                          <span className="inline-flex items-center gap-0.5 text-[#22FF66] font-mono tabular-nums">
                            <ArrowUpRight className="h-3 w-3" />
                            {p.subMinute}&apos;
                          </span>
                        )}
                        {p.goals && p.goals > 0 ? (
                          <span className="text-[#22FF66] font-medium">
                            {lang === 'fa' ? `${p.goals} گل` : `${p.goals}G`}
                          </span>
                        ) : null}
                        {p.yellowCard && (
                          <span className="text-amber-400">
                            {lang === 'fa' ? 'کارت زرد' : 'YC'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {p.rating > 0 ? (
                    <span
                      className={`min-w-[38px] px-2 py-0.5 rounded text-center text-xs font-mono tabular-nums shrink-0 ${ratingBadgeTone(
                        p.rating,
                        p.isManOfTheMatch
                      )}`}
                    >
                      {p.rating.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-slate-600 shrink-0">—</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Player of the Match Spotlight */}
      {playerOfTheMatch && (
        <div className="rounded-xl bg-[#090B0E] border border-[#22FF66]/30 p-3.5 sm:p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <PlayerAvatar
              name={localize(playerOfTheMatch.name)}
              photoUrl={playerOfTheMatch.photoUrl}
              size={48}
              accent="home"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#22FF66]">
                <Award className="h-3.5 w-3.5 shrink-0" />
                <span>{t.matchCenter.manOfTheMatch}</span>
              </div>
              <div className="text-sm sm:text-base font-bold text-white truncate mt-0.5">
                {localize(playerOfTheMatch.name)}
              </div>
              {playerOfTheMatch.teamSide && (
                <div className="text-xs text-slate-400 truncate">
                  {playerOfTheMatch.teamSide === 'home' ? homeName : awayName}
                </div>
              )}
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-[#22FF66] text-[#090B0E] font-mono font-bold tabular-nums text-base sm:text-lg shrink-0">
            {playerOfTheMatch.rating.toFixed(1)}
          </div>
        </div>
      )}

      {/* Side Switcher for Tactical Pitch */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid grid-cols-2 sm:inline-flex items-center gap-1 p-1 rounded-lg bg-[#090B0E] border border-white/[0.07] w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSelectedSide('home')}
            className={`min-h-[40px] px-2.5 sm:px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors truncate ${
              selectedSide === 'home'
                ? 'bg-[#22FF66] text-[#090B0E] font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {homeName} · {homeFormation}
          </button>
          <button
            type="button"
            onClick={() => setSelectedSide('away')}
            className={`min-h-[40px] px-2.5 sm:px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors truncate ${
              selectedSide === 'away'
                ? 'bg-sky-400 text-[#090B0E] font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {awayName} · {awayFormation}
          </button>
        </div>
      </div>

      {/* Tactical SVG Pitch */}
      <div
        dir="ltr"
        className="relative w-full aspect-[4/4.3] sm:aspect-[16/10] rounded-xl overflow-hidden bg-[#0E1E16] border border-white/[0.08]"
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <rect x="0" y="0" width="100" height="100" fill="#0D1C14" />
          {[0, 20, 40, 60, 80].map((y) => (
            <rect key={y} x="0" y={y} width="100" height="10" fill="#11241A" />
          ))}
          <rect x="3" y="3" width="94" height="94" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.45" />
          <rect x="26" y="3" width="48" height="17" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.45" />
          <rect x="38" y="3" width="24" height="7" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.45" />
          <line x1="3" y1="97" x2="97" y2="97" stroke="rgba(255,255,255,0.22)" strokeWidth="0.45" />
          <circle cx="50" cy="97" r="12" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.45" />
        </svg>

        {activeXI.map((player, idx) => (
          <div
            key={`${selectedSide}-${player.number}-${idx}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
            style={{ left: `${player.x}%`, top: `${player.y}%` }}
          >
            <div className="relative">
              <PlayerAvatar
                name={localize(player.name)}
                photoUrl={player.photoUrl}
                shirtNumber={player.number}
                size={36}
                accent={selectedSide === 'home' ? 'home' : 'away'}
                className={`w-8 h-8 sm:w-10 sm:h-10 shadow-md ${
                  player.isManOfTheMatch ? 'ring-2 ring-[#22FF66]' : ''
                }`}
              />
              {player.number > 0 && (
                <span
                  className={`absolute -bottom-1 -left-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#090B0E] border text-[9px] font-mono font-bold tabular-nums flex items-center justify-center ${
                    selectedSide === 'home'
                      ? 'border-[#22FF66]/60 text-[#22FF66]'
                      : 'border-sky-400/60 text-sky-300'
                  }`}
                >
                  {player.number}
                </span>
              )}
              {player.rating > 0 && (
                <span
                  className={`absolute -top-1.5 -right-2.5 px-1 rounded text-[9px] sm:text-[10px] font-mono tabular-nums ${
                    player.isManOfTheMatch || player.rating >= 8.2
                      ? 'bg-[#22FF66] text-[#090B0E] font-bold'
                      : 'bg-[#090B0E] border border-white/15 text-slate-100'
                  }`}
                >
                  {player.rating.toFixed(1)}
                </span>
              )}
            </div>
            <span className="mt-1.5 text-[9px] sm:text-[11px] font-medium text-white bg-[#090B0E]/85 px-1 sm:px-1.5 py-0.5 rounded whitespace-nowrap max-w-[58px] sm:max-w-[88px] truncate">
              {localize(player.name)}
            </span>
          </div>
        ))}
      </div>

      {/* Complete Player Ratings & Substitutes Tables */}
      <div className="space-y-3 pt-2 border-t border-white/[0.06]">
        <h3 className="text-sm font-bold text-white">{t.matchCenter.playerRatings}</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderRosterColumn(homeName, homeFormation, homeXI, homeSubs, 'home')}
          {renderRosterColumn(awayName, awayFormation, awayXI, awaySubs, 'away')}
        </div>
      </div>
    </div>
  );
};
