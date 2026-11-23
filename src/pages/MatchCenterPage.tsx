import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Brain, Loader2, Star } from 'lucide-react';
import type { AIMatchAnalysisResponse, League, Match, Team } from '../types/football';
import { useLanguage } from '../i18n/LanguageContext';
import { aiService } from '../services/aiService';
import { TeamCrest } from '../components/ui/TeamCrest';
import { StatBar } from '../components/ui/StatBar';
import { MomentumChart } from '../components/matches/MomentumChart';
import { TacticalHeatmap } from '../components/matches/TacticalHeatmap';
import { WinProbabilityGraph } from '../components/matches/WinProbabilityGraph';
import { PitchFormation } from '../components/ui/PitchFormation';
import { PlayerAvatar } from '../components/ui/PlayerAvatar';

interface MatchCenterPageProps {
  match: Match;
  league: League;
  homeTeam: Team;
  awayTeam: Team;
  isFavorite: boolean;
  isDemoData?: boolean;
  loadingDetail?: boolean;
  onToggleFavorite: (matchId: string) => void;
  onBack: () => void;
  onSelectTeam: (teamId: string) => void;
}

type MatchTab = 'summary' | 'stats' | 'lineups' | 'heatmap' | 'h2h' | 'ai';

export const MatchCenterPage: React.FC<MatchCenterPageProps> = ({
  match,
  league,
  homeTeam,
  awayTeam,
  isFavorite,
  isDemoData = false,
  loadingDetail = false,
  onToggleFavorite,
  onBack,
  onSelectTeam,
}) => {
  const { t, lang, isRtl, localize } = useLanguage();
  const [activeTab, setActiveTab] = useState<MatchTab>('summary');
  const [aiResult, setAiResult] = useState<AIMatchAnalysisResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleRunAi = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const data = await aiService.analyzeMatch(match.id, lang);
      setAiResult(data);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to generate AI breakdown.');
    } finally {
      setAiLoading(false);
    }
  };

  const tabs: { id: MatchTab; label: string }[] = [
    { id: 'summary', label: t.matchCenter.tabs.summary },
    { id: 'stats', label: t.matchCenter.tabs.stats },
    { id: 'lineups', label: t.matchCenter.tabs.lineups },
    { id: 'heatmap', label: t.matchCenter.tabs.heatmap },
    { id: 'h2h', label: t.matchCenter.tabs.h2h },
    { id: 'ai', label: t.matchCenter.tabs.ai },
  ];

  const isLive = match.status === 'LIVE';

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-full min-w-0">
      {/* Contextual Top Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[42px] px-3 py-1.5 rounded-lg bg-[#12161B] border border-white/[0.07] text-xs font-medium text-slate-300 hover:text-white inline-flex items-center gap-2 shrink-0"
        >
          {isRtl ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
          <span>{t.common.back}</span>
        </button>

        <button
          type="button"
          onClick={() => onToggleFavorite(match.id)}
          className={`min-h-[42px] px-3.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-2 transition-colors shrink-0 ${
            isFavorite
              ? 'bg-[#22FF66]/10 border-[#22FF66]/40 text-[#22FF66]'
              : 'bg-[#12161B] border-white/[0.07] text-slate-300 hover:text-white'
          }`}
        >
          <Star className={`h-4 w-4 ${isFavorite ? 'fill-[#22FF66]' : ''}`} />
          <span>{isFavorite ? t.common.favorited : t.common.favorite}</span>
        </button>
      </div>

      {/* Match Scoreboard Header */}
      <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] p-4 sm:p-7 space-y-4 sm:space-y-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] sm:text-xs text-slate-400 text-center">
          <span className="font-mono text-[#22FF66]">{league.code}</span>
          <span>{localize(league.name)}</span>
          <span aria-hidden="true">·</span>
          <span>{localize(match.round)}</span>
          {match.matchDate && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-300">{match.matchDate}</span>
            </>
          )}
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">{localize(match.venue)}</span>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-8">
          <button
            type="button"
            onClick={() => onSelectTeam(homeTeam.id)}
            className="flex flex-col items-center gap-2 sm:gap-2.5 group min-w-0"
          >
            <TeamCrest team={homeTeam} size={56} className="w-11 h-11 sm:w-14 sm:h-14" />
            <span className="text-sm sm:text-xl font-bold text-white group-hover:text-[#22FF66] transition-colors text-center leading-tight line-clamp-2 break-words w-full">
              {localize(homeTeam.name)}
            </span>
            <span className="text-[11px] sm:text-xs font-mono tabular-nums text-slate-400">
              {match.lineups.homeFormation}
            </span>
          </button>

          <div className="text-center space-y-1 sm:space-y-1.5 px-1 sm:px-2 min-w-[76px] sm:min-w-[112px] shrink-0">
            {match.status === 'UPCOMING' ? (
              <div className="text-xl sm:text-3xl font-mono font-bold tabular-nums text-slate-200 whitespace-nowrap">
                {match.kickoffTime}
              </div>
            ) : (
              <div
                dir="ltr"
                className="text-2xl sm:text-5xl font-mono font-bold tabular-nums text-white whitespace-nowrap"
              >
                {match.homeScore ?? 0} - {match.awayScore ?? 0}
              </div>
            )}
            <div
              className={`text-[11px] sm:text-xs font-mono tabular-nums font-semibold whitespace-nowrap ${
                isLive ? 'text-[#22FF66]' : 'text-slate-400'
              }`}
            >
              {isLive
                ? `${isDemoData ? (lang === 'fa' ? 'آزمایشی' : 'Demo') : t.common.liveNow} · ${match.minute}${t.common.minuteSuffix}`
                : match.status}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectTeam(awayTeam.id)}
            className="flex flex-col items-center gap-2 sm:gap-2.5 group min-w-0"
          >
            <TeamCrest team={awayTeam} size={56} className="w-11 h-11 sm:w-14 sm:h-14" />
            <span className="text-sm sm:text-xl font-bold text-white group-hover:text-sky-400 transition-colors text-center leading-tight line-clamp-2 break-words w-full">
              {localize(awayTeam.name)}
            </span>
            <span className="text-[11px] sm:text-xs font-mono tabular-nums text-slate-400">
              {match.lineups.awayFormation}
            </span>
          </button>
        </div>

        {/* Referee & Venue Footnote */}
        <div className="pt-3.5 sm:pt-4 border-t border-white/[0.06] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] sm:text-xs text-slate-400 text-center">
          <span>
            {t.matchCenter.referee}: <strong className="text-slate-200 font-medium">{localize(match.referee)}</strong>
          </span>
          {match.attendance && match.attendance > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {t.matchCenter.attendance}:{' '}
                <strong className="font-mono tabular-nums text-slate-200">
                  {match.attendance.toLocaleString()}
                </strong>
              </span>
            </>
          )}
          {match.hasXg && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {t.common.xG}:{' '}
                <strong dir="ltr" className="font-mono tabular-nums text-slate-200">
                  {match.stats.xG[0].toFixed(2)} - {match.stats.xG[1].toFixed(2)}
                </strong>
              </span>
            </>
          )}
          {loadingDetail && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-[#22FF66]">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{lang === 'fa' ? 'در حال دریافت آمار زنده...' : 'Syncing match stats...'}</span>
              </span>
            </>
          )}
        </div>
      </section>

      {/* Match Center Tabs */}
      <div className="w-full max-w-full flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-white/[0.07] pb-2">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[42px] px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[#22FF66] text-[#090B0E] font-semibold'
                  : 'text-slate-400 hover:bg-[#12161B] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="rounded-2xl bg-[#12161B] border border-white/[0.07] p-4 sm:p-6 overflow-hidden">
        {activeTab === 'summary' && (
          <div className="space-y-8">
            {match.playerOfTheMatch && (
              <div className="rounded-xl bg-[#090B0E] border border-[#22FF66]/30 p-3.5 sm:p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <PlayerAvatar
                    name={localize(match.playerOfTheMatch.name)}
                    photoUrl={match.playerOfTheMatch.photoUrl}
                    size={44}
                    accent="home"
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-[#22FF66]">
                      {t.matchCenter.manOfTheMatch}
                    </div>
                    <div className="text-sm sm:text-base font-bold text-white truncate">
                      {localize(match.playerOfTheMatch.name)}
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-[#22FF66] text-[#090B0E] font-mono font-bold tabular-nums text-sm sm:text-base shrink-0">
                  {match.playerOfTheMatch.rating.toFixed(1)}
                </span>
              </div>
            )}

            <div className="space-y-4">
              <h2 className="text-base font-bold text-white">{t.matchCenter.matchEvents}</h2>
              {match.events.length === 0 ? (
                <p className="text-sm text-slate-400 py-4">{t.matchCenter.noEventsYet}</p>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {match.events.map((ev) => (
                    <div
                      key={ev.id}
                      className={`py-3 flex items-center gap-2.5 sm:gap-4 text-sm ${
                        ev.teamSide === 'away' ? 'flex-row-reverse text-end' : ''
                      }`}
                    >
                      <span className="font-mono tabular-nums text-xs font-semibold text-[#22FF66] w-10 sm:w-12 shrink-0 text-center">
                        {ev.minute}
                        {ev.addedTime ? `+${ev.addedTime}` : ''}
                        {t.common.minuteSuffix}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`flex items-center gap-2 flex-wrap ${ev.teamSide === 'away' ? 'justify-end' : ''}`}>
                          <span className="font-semibold text-white break-words">
                            {localize(ev.playerName)}
                          </span>
                          <span
                            className={`text-xs font-medium shrink-0 ${
                              ev.type === 'goal'
                                ? 'text-[#22FF66]'
                                : ev.type === 'yellow'
                                  ? 'text-amber-400'
                                  : ev.type === 'red'
                                    ? 'text-red-400'
                                    : 'text-slate-400'
                            }`}
                          >
                            {ev.type.toUpperCase()}
                          </span>
                        </div>
                        {ev.assistOrDetail && (
                          <p className="text-xs text-slate-400 mt-0.5 break-words">
                            {localize(ev.assistOrDetail)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-white/[0.06]">
              <WinProbabilityGraph match={match} homeTeam={homeTeam} awayTeam={awayTeam} />
            </div>

            <div className="pt-6 border-t border-white/[0.06] space-y-4">
              <h2 className="text-base font-bold text-white">{t.matchCenter.attackMomentum}</h2>
              <MomentumChart
                data={match.momentum}
                homeName={localize(homeTeam.name)}
                awayName={localize(awayTeam.name)}
              />
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          match.status === 'UPCOMING' && !match.hasDetailedStats ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              {lang === 'fa'
                ? 'آمار رسمی مسابقه پس از سوت آغاز نمایش داده می‌شود.'
                : 'Live match statistics will appear once kickoff begins.'}
            </p>
          ) : (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="divide-y divide-white/[0.05]">
                <StatBar
                  label={t.common.possession}
                  homeValue={match.stats.possession[0]}
                  awayValue={match.stats.possession[1]}
                  suffix="%"
                />
                {match.hasXg && (
                  <StatBar
                    label={t.common.xG}
                    homeValue={match.stats.xG[0]}
                    awayValue={match.stats.xG[1]}
                    decimals={2}
                  />
                )}
                <StatBar
                  label={t.common.shots}
                  homeValue={match.stats.totalShots[0]}
                  awayValue={match.stats.totalShots[1]}
                />
                <StatBar
                  label={t.common.shotsOnTarget}
                  homeValue={match.stats.shotsOnTarget[0]}
                  awayValue={match.stats.shotsOnTarget[1]}
                />
                <StatBar
                  label={match.hasXg ? t.common.bigChances : lang === 'fa' ? 'آفساید' : 'Offsides'}
                  homeValue={match.stats.bigChances[0]}
                  awayValue={match.stats.bigChances[1]}
                />
                <StatBar
                  label={match.hasXg ? t.common.passAccuracy : lang === 'fa' ? 'دقت شوت' : 'Shot Accuracy'}
                  homeValue={match.stats.passAccuracy[0]}
                  awayValue={match.stats.passAccuracy[1]}
                  suffix="%"
                />
                <StatBar
                  label={t.common.corners}
                  homeValue={match.stats.corners[0]}
                  awayValue={match.stats.corners[1]}
                />
                <StatBar
                  label={match.hasXg ? t.common.tackles : lang === 'fa' ? 'مهار دروازه‌بان' : 'Goalkeeper Saves'}
                  homeValue={match.stats.tackles[0]}
                  awayValue={match.stats.tackles[1]}
                />
                <StatBar
                  label={t.common.fouls}
                  homeValue={match.stats.fouls[0]}
                  awayValue={match.stats.fouls[1]}
                />
              </div>

              {match.extraStats && match.extraStats.length > 0 && (
                <div className="pt-4 border-t border-white/[0.07] space-y-2">
                  <h3 className="text-xs font-semibold text-slate-400">
                    {t.matchCenter.additionalStats}
                  </h3>
                  <div className="divide-y divide-white/[0.05]">
                    {match.extraStats.map((st, i) => (
                      <StatBar
                        key={i}
                        label={localize(st.label)}
                        homeValue={st.home}
                        awayValue={st.away}
                        suffix={st.suffix}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {activeTab === 'lineups' && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white">{t.matchCenter.startingXI}</h2>
            <PitchFormation
              homeName={localize(homeTeam.name)}
              awayName={localize(awayTeam.name)}
              homeFormation={match.lineups.homeFormation}
              awayFormation={match.lineups.awayFormation}
              homeXI={match.lineups.homeXI}
              awayXI={match.lineups.awayXI}
              homeSubs={match.lineups.homeSubs}
              awaySubs={match.lineups.awaySubs}
              playerOfTheMatch={match.playerOfTheMatch}
            />
          </div>
        )}

        {activeTab === 'heatmap' && (
          <TacticalHeatmap match={match} homeTeam={homeTeam} awayTeam={awayTeam} />
        )}

        {activeTab === 'h2h' && (
          <div className="space-y-6">
            <h2 className="text-base font-bold text-white">{t.matchCenter.headToHead}</h2>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-4 text-center">
              <div className="p-3 sm:p-4 rounded-xl bg-[#090B0E] border border-white/[0.06]">
                <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-[#22FF66]">
                  {match.h2h.homeWins}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-400 mt-1 break-words">{t.matchCenter.homeWins}</div>
              </div>
              <div className="p-3 sm:p-4 rounded-xl bg-[#090B0E] border border-white/[0.06]">
                <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-slate-200">
                  {match.h2h.draws}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-400 mt-1 break-words">{t.matchCenter.draws}</div>
              </div>
              <div className="p-3 sm:p-4 rounded-xl bg-[#090B0E] border border-white/[0.06]">
                <div className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-sky-400">
                  {match.h2h.awayWins}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-400 mt-1 break-words">{t.matchCenter.awayWins}</div>
              </div>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {match.h2h.recentMeetings.map((item, idx) => (
                <div
                  key={idx}
                  className="py-3 flex items-center justify-between gap-2 text-xs sm:text-sm min-w-0"
                >
                  <span className="text-xs font-mono tabular-nums text-slate-500 truncate min-w-0">
                    {item.date} · {item.competition}
                  </span>
                  <span dir="ltr" className="font-mono font-semibold tabular-nums text-white shrink-0">
                    {item.homeShort} {item.score} {item.awayShort}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Brain className="h-5 w-5 text-[#22FF66] shrink-0" />
                  <span>{t.matchCenter.tabs.ai}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">{t.matchCenter.aiPromptHint}</p>
              </div>
              <button
                type="button"
                disabled={aiLoading}
                onClick={handleRunAi}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-lg bg-[#22FF66] text-[#090B0E] text-sm font-semibold hover:bg-[#3bff77] disabled:opacity-60 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                {aiLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>
                  {aiLoading ? t.matchCenter.generatingAi : t.matchCenter.runAiBreakdown}
                </span>
              </button>
            </div>

            {aiError && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-200">
                {aiError}
              </div>
            )}

            {aiResult && (
              <div className="space-y-5 pt-4 border-t border-white/[0.07]">
                <h3 className="text-lg font-bold text-white">{aiResult.headline}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {aiResult.tacticalSummary}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-[#090B0E] border border-white/[0.06] space-y-1.5">
                    <div className="text-xs font-semibold text-[#22FF66]">{t.aiLab.keyBattle}</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{aiResult.keyBattle}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#090B0E] border border-white/[0.06] space-y-1.5">
                    <div className="text-xs font-semibold text-sky-400">
                      {t.aiLab.momentumInsight}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {aiResult.momentumInsight}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#090B0E] border border-white/[0.06] space-y-1.5">
                    <div className="text-xs font-semibold text-amber-400">
                      {t.aiLab.predictedEdge}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {aiResult.predictedEdge}
                    </p>
                  </div>
                </div>

                {aiResult.tacticalBullets.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-400">{t.aiLab.keyPoints}</div>
                    <ul className="space-y-2 text-sm text-slate-200">
                      {aiResult.tacticalBullets.map((b, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="font-mono text-xs text-[#22FF66] mt-0.5">
                            0{i + 1}.
                          </span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
