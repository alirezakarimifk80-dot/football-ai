import React, { useMemo, useState } from 'react';
import { Brain, Loader2, Send, Sparkles } from 'lucide-react';
import type {
  AIAskResponse,
  AIMatchAnalysisResponse,
  AIPlayerCompareResponse,
  Match,
  Player,
  Team,
} from '../types/football';
import { useLanguage } from '../i18n/LanguageContext';
import { aiService } from '../services/aiService';
import { PlayerAvatar } from '../components/ui/PlayerAvatar';

interface AILabPageProps {
  matches: Match[];
  teams: Team[];
  players: Player[];
  initialMatchId?: string;
  initialPlayerAId?: string;
}

type LabMode = 'match' | 'compare' | 'ask';

export const AILabPage: React.FC<AILabPageProps> = ({
  matches,
  teams,
  players,
  initialMatchId,
  initialPlayerAId,
}) => {
  const { t, lang, localize } = useLanguage();
  const [mode, setMode] = useState<LabMode>(initialPlayerAId ? 'compare' : 'match');
  const [matchId, setMatchId] = useState<string>(initialMatchId ?? matches[0]?.id ?? '');
  const [playerAId, setPlayerAId] = useState<string>(initialPlayerAId ?? players[0]?.id ?? '');
  const [playerBId, setPlayerBId] = useState<string>(
    players.find((p) => p.id !== (initialPlayerAId ?? players[0]?.id))?.id ?? players[1]?.id ?? ''
  );
  const [question, setQuestion] = useState('');

  const effectiveMatchId = matches.some((m) => m.id === matchId) ? matchId : (matches[0]?.id ?? '');
  const effectivePlayerAId = players.some((p) => p.id === playerAId)
    ? playerAId
    : (players[0]?.id ?? '');
  const effectivePlayerBId =
    players.some((p) => p.id === playerBId) && playerBId !== effectivePlayerAId
      ? playerBId
      : (players.find((p) => p.id !== effectivePlayerAId)?.id ?? players[1]?.id ?? '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchAnalysis, setMatchAnalysis] = useState<AIMatchAnalysisResponse | null>(null);
  const [playerCompare, setPlayerCompare] = useState<AIPlayerCompareResponse | null>(null);
  const [askResponse, setAskResponse] = useState<AIAskResponse | null>(null);

  const teamMap = useMemo(() => new Map(teams.map((tm) => [tm.id, tm])), [teams]);

  const handleAnalyzeMatch = async () => {
    if (!effectiveMatchId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await aiService.analyzeMatch(effectiveMatchId, lang);
      setMatchAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run tactical analysis');
    } finally {
      setLoading(false);
    }
  };

  const handleComparePlayers = async () => {
    if (!effectivePlayerAId || !effectivePlayerBId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await aiService.comparePlayers(effectivePlayerAId, effectivePlayerBId, lang);
      setPlayerCompare(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare players');
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = async (overridePrompt?: string) => {
    const q = (overridePrompt ?? question).trim();
    if (!q) return;
    if (overridePrompt) setQuestion(overridePrompt);
    setLoading(true);
    setError(null);
    try {
      const result = await aiService.askAnalyst(q, lang);
      setAskResponse(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach AI analyst');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-full min-w-0">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2.5">
          <Brain className="h-6 w-6 text-[#22FF66] shrink-0" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{t.aiLab.title}</h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-400 max-w-3xl leading-relaxed">{t.aiLab.subtitle}</p>
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-1 sm:inline-flex items-center gap-1 p-1 rounded-xl bg-[#12161B] border border-white/[0.07] w-full sm:w-auto">
        {(['match', 'compare', 'ask'] as LabMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`min-h-[44px] sm:min-h-[42px] px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 text-center ${
              mode === m
                ? 'bg-[#22FF66] text-[#090B0E] font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.aiLab.modes[m]}
          </button>
        ))}
      </div>

      {/* Main Workspace Surface */}
      <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-hidden">
        {mode === 'match' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
              <label className="block space-y-1.5 min-w-0">
                <span className="text-xs font-medium text-slate-400">{t.aiLab.selectMatch}</span>
                <select
                  value={effectiveMatchId}
                  onChange={(e) => setMatchId(e.target.value)}
                  className="w-full max-w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#090B0E] border border-white/[0.1] text-sm text-white focus:border-[#22FF66] truncate"
                >
                  {matches.map((m) => {
                    const home = teamMap.get(m.homeTeamId);
                    const away = teamMap.get(m.awayTeamId);
                    const score =
                      m.homeScore !== null && m.awayScore !== null
                        ? `${m.homeScore} - ${m.awayScore}`
                        : m.kickoffTime;
                    return (
                      <option key={m.id} value={m.id}>
                        {home ? localize(home.name) : m.homeTeamId} ({score}){' '}
                        {away ? localize(away.name) : m.awayTeamId} · {m.status}
                      </option>
                    );
                  })}
                </select>
              </label>

              <button
                type="button"
                disabled={loading}
                onClick={handleAnalyzeMatch}
                className="w-full md:w-auto min-h-[44px] px-5 py-2.5 rounded-lg bg-[#22FF66] text-[#090B0E] text-sm font-semibold hover:bg-[#3bff77] disabled:opacity-60 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span>{t.aiLab.runAnalysis}</span>
              </button>
            </div>

            {matchAnalysis && (
              <div className="space-y-5 pt-5 border-t border-white/[0.07]">
                <h2 className="text-xl font-bold text-white">{matchAnalysis.headline}</h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {matchAnalysis.tacticalSummary}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-[#090B0E] border border-white/[0.06] space-y-1.5">
                    <div className="text-xs font-semibold text-[#22FF66]">{t.aiLab.keyBattle}</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{matchAnalysis.keyBattle}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#090B0E] border border-white/[0.06] space-y-1.5">
                    <div className="text-xs font-semibold text-sky-400">
                      {t.aiLab.momentumInsight}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {matchAnalysis.momentumInsight}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#090B0E] border border-white/[0.06] space-y-1.5">
                    <div className="text-xs font-semibold text-amber-400">
                      {t.aiLab.predictedEdge}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {matchAnalysis.predictedEdge}
                    </p>
                  </div>
                </div>

                {matchAnalysis.tacticalBullets.length > 0 && (
                  <ul className="space-y-2 text-sm text-slate-200">
                    {matchAnalysis.tacticalBullets.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="font-mono text-xs text-[#22FF66] mt-0.5">0{idx + 1}.</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {mode === 'compare' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-end">
              <label className="block space-y-1.5 min-w-0">
                <span className="text-xs font-medium text-slate-400">{t.aiLab.selectPlayerA}</span>
                <select
                  value={effectivePlayerAId}
                  onChange={(e) => setPlayerAId(e.target.value)}
                  className="w-full max-w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#090B0E] border border-white/[0.1] text-sm text-white truncate"
                >
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {localize(p.name)} ({p.position})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5 min-w-0">
                <span className="text-xs font-medium text-slate-400">{t.aiLab.selectPlayerB}</span>
                <select
                  value={effectivePlayerBId}
                  onChange={(e) => setPlayerBId(e.target.value)}
                  className="w-full max-w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#090B0E] border border-white/[0.1] text-sm text-white truncate"
                >
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {localize(p.name)} ({p.position})
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                disabled={loading || effectivePlayerAId === effectivePlayerBId}
                onClick={handleComparePlayers}
                className="w-full md:w-auto min-h-[44px] px-5 py-2.5 rounded-lg bg-[#22FF66] text-[#090B0E] text-sm font-semibold hover:bg-[#3bff77] disabled:opacity-60 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span>{t.aiLab.runCompare}</span>
              </button>
            </div>

            {playerCompare && (
              <div className="space-y-5 pt-5 border-t border-white/[0.07]">
                <h2 className="text-xl font-bold text-white">{playerCompare.headline}</h2>
                <p className="text-sm text-slate-300 leading-relaxed">{playerCompare.verdict}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(() => {
                    const pA = players.find((p) => p.id === effectivePlayerAId);
                    const pB = players.find((p) => p.id === effectivePlayerBId);
                    return (
                      <>
                        <div className="p-4 rounded-xl bg-[#090B0E] border border-white/[0.06] space-y-2.5">
                          <div className="flex items-center gap-2.5">
                            <PlayerAvatar
                              name={localize(pA?.name ?? { en: 'Player A', fa: 'بازیکن اول' })}
                              photoUrl={pA?.photoUrl}
                              shirtNumber={pA?.shirtNumber}
                              size={34}
                              accent="home"
                            />
                            <div className="text-xs font-semibold text-[#22FF66] truncate">
                              {localize(pA?.name ?? { en: 'Player A', fa: 'بازیکن اول' })} ·{' '}
                              {t.aiLab.strengths}
                            </div>
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-300">
                            {playerCompare.playerAStrengths.map((s, idx) => (
                              <li key={idx}>• {s}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-4 rounded-xl bg-[#090B0E] border border-white/[0.06] space-y-2.5">
                          <div className="flex items-center gap-2.5">
                            <PlayerAvatar
                              name={localize(pB?.name ?? { en: 'Player B', fa: 'بازیکن دوم' })}
                              photoUrl={pB?.photoUrl}
                              shirtNumber={pB?.shirtNumber}
                              size={34}
                              accent="away"
                            />
                            <div className="text-xs font-semibold text-sky-400 truncate">
                              {localize(pB?.name ?? { en: 'Player B', fa: 'بازیکن دوم' })} ·{' '}
                              {t.aiLab.strengths}
                            </div>
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-300">
                            {playerCompare.playerBStrengths.map((s, idx) => (
                              <li key={idx}>• {s}</li>
                            ))}
                          </ul>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="p-4 rounded-xl bg-[#090B0E] border border-white/[0.06] space-y-1">
                  <div className="text-xs font-semibold text-slate-400">{t.aiLab.tacticalFit}</div>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {playerCompare.tacticalFitSummary}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'ask' && (
          <div className="space-y-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAsk();
              }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t.aiLab.askPlaceholder}
                className="w-full min-w-0 flex-1 min-h-[46px] px-4 py-2.5 rounded-lg bg-[#090B0E] border border-white/[0.1] text-sm text-white placeholder:text-slate-500 focus:border-[#22FF66] focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || question.trim().length < 3}
                className="w-full sm:w-auto min-h-[46px] px-5 py-2.5 rounded-lg bg-[#22FF66] text-[#090B0E] text-sm font-semibold hover:bg-[#3bff77] disabled:opacity-60 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span>{t.aiLab.sendQuestion}</span>
              </button>
            </form>

            {/* Quick Suggested Prompts */}
            <div className="flex flex-wrap gap-2">
              {t.aiLab.quickPrompts.map((promptText, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={loading}
                  onClick={() => handleAsk(promptText)}
                  className="text-start text-xs px-3 py-2.5 rounded-lg bg-[#090B0E] border border-white/[0.07] text-slate-300 hover:border-[#22FF66]/40 hover:text-white transition-colors break-words max-w-full"
                >
                  {promptText}
                </button>
              ))}
            </div>

            {askResponse && (
              <div className="space-y-4 pt-5 border-t border-white/[0.07]">
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                  {askResponse.answer}
                </p>
                {askResponse.keyTakeaways.length > 0 && (
                  <ul className="space-y-2 text-xs text-slate-300 pt-2">
                    {askResponse.keyTakeaways.map((tk, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-mono text-[#22FF66]">0{idx + 1}.</span>
                        <span>{tk}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-200">
            {error}
          </div>
        )}

        <p className="text-xs text-slate-500 pt-2 border-t border-white/[0.05]">
          {t.aiLab.groundingNote}
        </p>
      </section>
    </div>
  );
};
