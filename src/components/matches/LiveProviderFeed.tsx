import React from 'react';
import { Radio } from 'lucide-react';
import type { LiveDeltaEvent, NormalizedFixture } from '../../../backend/src/types/football';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatUtcToLocalTime } from '../../services/liveFootballApiService';
import { TeamCrest } from '../ui/TeamCrest';

interface LiveProviderFeedProps {
  sseConnected: boolean;
  liveFixtures: NormalizedFixture[];
  lastDelta: LiveDeltaEvent | null;
}

export const LiveProviderFeed: React.FC<LiveProviderFeedProps> = ({
  sseConnected,
  liveFixtures,
  lastDelta,
}) => {
  const { lang } = useLanguage();
  const isFa = lang === 'fa';

  if (liveFixtures.length === 0 && !lastDelta?.summary) {
    return null;
  }

  return (
    <section className="rounded-xl bg-[#12161B] border border-[#22FF66]/30 p-3.5 sm:p-4 space-y-3 w-full max-w-full overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 font-semibold text-white min-w-0">
          <Radio className="h-4 w-4 text-[#22FF66] shrink-0" />
          <span className="truncate">
            {isFa ? 'فید زنده API-Football (بدون نیاز به رفرش)' : 'API-Football Live SSE Feed'}
          </span>
        </div>
        <span className="font-mono tabular-nums text-slate-400 shrink-0">
          {sseConnected ? 'SSE Connected' : 'SSE Reconnecting'} · {liveFixtures.length}{' '}
          {isFa ? 'بازی زنده' : 'live fixtures'}
        </span>
      </div>

      {lastDelta?.summary && (
        <div className="text-xs text-[#22FF66] font-mono break-words">
          {lastDelta.summary}
        </div>
      )}

      {liveFixtures.length > 0 && (
        <div className="divide-y divide-white/[0.06]">
          {liveFixtures.map((f) => (
            <div
              key={f.providerId}
              className="py-2.5 space-y-1.5 text-xs sm:text-sm"
            >
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5 min-w-0">
                  {f.league.logo && (
                    <TeamCrest
                      logoUrl={f.league.logo}
                      alt={f.league.name}
                      size={14}
                      className="w-3.5 h-3.5"
                    />
                  )}
                  <span className="truncate">
                    {f.league.name} · #{f.providerId} · {formatUtcToLocalTime(f.utcKickoff, lang)}
                  </span>
                </div>
                <span className="font-mono tabular-nums text-slate-400 shrink-0">
                  {f.phase}
                  {f.elapsed !== null ? ` · ${f.elapsed}'` : ''}
                  {f.extraTime ? `+${f.extraTime}` : ''}
                </span>
              </div>

              {/* Mobile stacked fixture row with real API team logos */}
              <div className="sm:hidden space-y-1.5">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamCrest
                      logoUrl={f.homeTeam.logo}
                      alt={f.homeTeam.name}
                      size={20}
                    />
                    <span className="font-medium text-white truncate">{f.homeTeam.name}</span>
                  </div>
                  <span className="font-mono font-bold tabular-nums text-[#22FF66] shrink-0">
                    {f.goals.home ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamCrest
                      logoUrl={f.awayTeam.logo}
                      alt={f.awayTeam.name}
                      size={20}
                    />
                    <span className="font-medium text-white truncate">{f.awayTeam.name}</span>
                  </div>
                  <span className="font-mono font-bold tabular-nums text-[#22FF66] shrink-0">
                    {f.goals.away ?? 0}
                  </span>
                </div>
              </div>

              {/* Desktop balanced fixture row with real API team logos */}
              <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                <div className="flex items-center justify-end gap-2 min-w-0">
                  <span className="font-medium text-white truncate">{f.homeTeam.name}</span>
                  <TeamCrest
                    logoUrl={f.homeTeam.logo}
                    alt={f.homeTeam.name}
                    size={22}
                  />
                </div>
                <div
                  dir="ltr"
                  className="px-2.5 py-0.5 rounded bg-[#090B0E] border border-white/[0.06] font-mono font-bold tabular-nums text-[#22FF66] shrink-0"
                >
                  {f.goals.home ?? 0} - {f.goals.away ?? 0}
                </div>
                <div className="flex items-center justify-start gap-2 min-w-0">
                  <TeamCrest
                    logoUrl={f.awayTeam.logo}
                    alt={f.awayTeam.name}
                    size={22}
                  />
                  <span className="font-medium text-white truncate">{f.awayTeam.name}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
