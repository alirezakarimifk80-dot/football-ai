import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, RefreshCw, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AIWinProbabilityPoint, AIWinProbabilityResponse, Match, Team } from '../../types/football';
import { useLanguage } from '../../i18n/LanguageContext';
import { aiService } from '../../services/aiService';

interface WinProbabilityGraphProps {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload?: AIWinProbabilityPoint }[];
  homeName: string;
  awayName: string;
  drawLabel: string;
  isFa: boolean;
}

const WinProbTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  homeName,
  awayName,
  drawLabel,
  isFa,
}) => {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) return null;
  const pt = payload[0].payload;

  return (
    <div
      dir={isFa ? 'rtl' : 'ltr'}
      className="rounded-xl bg-[#12161B] border border-white/[0.12] px-3.5 py-2.5 shadow-xl text-xs space-y-1.5 max-w-[230px]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] pb-1">
        <span className="font-mono font-bold tabular-nums text-white">{pt.minute}&apos;</span>
        {pt.eventLabel && (
          <span className="text-[11px] font-medium text-amber-300 truncate">{pt.eventLabel}</span>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#22FF66] truncate">{homeName}</span>
          <span className="font-mono font-semibold tabular-nums text-white">{pt.homeWin}%</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">{drawLabel}</span>
          <span className="font-mono font-semibold tabular-nums text-slate-200">{pt.draw}%</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sky-400 truncate">{awayName}</span>
          <span className="font-mono font-semibold tabular-nums text-white">{pt.awayWin}%</span>
        </div>
      </div>
    </div>
  );
};

export const WinProbabilityGraph: React.FC<WinProbabilityGraphProps> = ({
  match,
  homeTeam,
  awayTeam,
}) => {
  const { lang, localize, t } = useLanguage();
  const isFa = lang === 'fa';

  const [data, setData] = useState<AIWinProbabilityResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  // Live fingerprint: automatically recalculates when score, status, or match events update
  const liveSignature = `${match.id}:${lang}:${match.status}:${match.homeScore ?? 'x'}-${match.awayScore ?? 'x'}:${match.events.length}`;

  const fetchWinProbability = useCallback(
    async (forceRefresh = false) => {
      const reqId = ++requestIdRef.current;
      setLoading(true);
      setError(null);
      try {
        const result = await aiService.getWinProbability(match.id, lang, forceRefresh);
        if (reqId === requestIdRef.current) {
          setData(result);
        }
      } catch (err) {
        if (reqId === requestIdRef.current) {
          setError(
            err instanceof Error
              ? err.message
              : isFa
                ? 'دریافت نمودار احتمال پیروزی هوشمند با خطا مواجه شد.'
                : 'Unable to generate AI win probability graph.'
          );
        }
      } finally {
        if (reqId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [match.id, lang, isFa]
  );

  useEffect(() => {
    void fetchWinProbability(false);
  }, [liveSignature, fetchWinProbability]);

  const homeName = localize(homeTeam.name);
  const awayName = localize(awayTeam.name);
  const isLive = match.status === 'LIVE' || match.status === 'HT';

  const turningPoints = useMemo(
    () => (data?.timeline ?? []).filter((pt) => Boolean(pt.eventLabel)),
    [data]
  );

  const formattedUpdatedTime = useMemo(() => {
    if (!data?.generatedAt) return '';
    try {
      return new Date(data.generatedAt).toLocaleTimeString(isFa ? 'fa-IR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [data?.generatedAt, isFa]);

  return (
    <div className="space-y-4 min-w-0">
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#22FF66] shrink-0" />
            <span>
              {isFa ? 'نمودار زنده احتمال پیروزی (هوش مصنوعی)' : 'AI Live Win Probability'}
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
            {isLive && (
              <>
                <span className="text-[#22FF66] font-medium">
                  {isFa ? 'به‌روزرسانی زنده با رویدادهای بازی' : 'Live event-synced'}
                </span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span>
              {isFa
                ? 'بر پایه رویدادهای مسابقه، جدول و فرم تاریخی دو تیم'
                : 'Grounded in match events & historical team performance'}
            </span>
            {formattedUpdatedTime && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-slate-500">
                  {formattedUpdatedTime}
                </span>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void fetchWinProbability(true)}
          disabled={loading}
          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#090B0E] border border-white/[0.08] hover:border-white/[0.2] text-xs font-medium text-slate-200 inline-flex items-center gap-1.5 shrink-0 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-[#22FF66] ${loading ? 'animate-spin' : ''}`} />
          <span>{isFa ? 'محاسبه مجدد' : 'Recalculate'}</span>
        </button>
      </div>

      {/* Loading Skeleton (Geometry-Matched) */}
      {loading && !data && (
        <div className="space-y-4 animate-pulse">
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="h-4 w-28 rounded bg-white/[0.06]" />
              <div className="h-4 w-16 rounded bg-white/[0.06]" />
              <div className="h-4 w-28 rounded bg-white/[0.06]" />
            </div>
            <div className="h-2.5 w-full rounded-full bg-white/[0.06]" />
          </div>
          <div className="h-60 w-full rounded-xl bg-[#090B0E] border border-white/[0.06]" />
        </div>
      )}

      {/* Honest Error State */}
      {error && !loading && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs sm:text-sm text-red-200 min-w-0">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span className="break-words">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void fetchWinProbability(true)}
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#12161B] border border-red-400/40 text-xs font-semibold text-white hover:bg-red-500/20 shrink-0"
          >
            {t.common.retry}
          </button>
        </div>
      )}

      {/* Populated Live AI Win Probability Split + Timeline Chart */}
      {data && (
        <div className="space-y-5">
          {/* 3-Way Current Win Probability Split Bar */}
          <div className="space-y-2">
            <div className="grid grid-cols-3 items-end gap-2 text-xs">
              <div className="min-w-0">
                <div className="text-slate-400 truncate">{homeName}</div>
                <div className="text-lg sm:text-xl font-mono font-bold tabular-nums text-[#22FF66]">
                  {data.current.homeWin}%
                </div>
              </div>
              <div className="text-center min-w-0">
                <div className="text-slate-400 truncate">{t.home.draw}</div>
                <div className="text-lg sm:text-xl font-mono font-bold tabular-nums text-slate-300">
                  {data.current.draw}%
                </div>
              </div>
              <div className="text-end min-w-0">
                <div className="text-slate-400 truncate">{awayName}</div>
                <div className="text-lg sm:text-xl font-mono font-bold tabular-nums text-sky-400">
                  {data.current.awayWin}%
                </div>
              </div>
            </div>

            <div
              dir="ltr"
              className="h-2.5 w-full rounded-full overflow-hidden flex bg-[#090B0E] border border-white/[0.06]"
              aria-label="Current win probability distribution"
            >
              <div
                className="h-full bg-[#22FF66] transition-all duration-300"
                style={{ width: `${data.current.homeWin}%` }}
              />
              <div
                className="h-full bg-slate-500/75 transition-all duration-300"
                style={{ width: `${data.current.draw}%` }}
              />
              <div
                className="h-full bg-sky-400 transition-all duration-300"
                style={{ width: `${data.current.awayWin}%` }}
              />
            </div>
          </div>

          {/* Interactive Timeline Graph */}
          {data.timeline.length > 0 && (
            <div
              dir="ltr"
              className="h-60 sm:h-64 w-full rounded-xl bg-[#090B0E] border border-white/[0.06] p-2.5 sm:p-4 overflow-hidden"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.timeline} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="winProbHomeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22FF66" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#22FF66" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="winProbAwayFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.26} />
                      <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.06)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="minute"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(v) => `${v}'`}
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <ReferenceLine
                    y={50}
                    stroke="rgba(255,255,255,0.16)"
                    strokeDasharray="4 4"
                  />
                  {data.timeline[data.timeline.length - 1].minute >= 45 && (
                    <ReferenceLine
                      x={45}
                      stroke="rgba(255,255,255,0.18)"
                      strokeDasharray="3 3"
                      label={{
                        value: 'HT',
                        position: 'insideTopRight',
                        fill: '#94A3B8',
                        fontSize: 10,
                      }}
                    />
                  )}

                  <Tooltip
                    content={
                      <WinProbTooltip
                        homeName={homeName}
                        awayName={awayName}
                        drawLabel={t.home.draw}
                        isFa={isFa}
                      />
                    }
                  />

                  <Area
                    type="monotone"
                    dataKey="homeWin"
                    name={homeName}
                    stroke="#22FF66"
                    strokeWidth={2.2}
                    fill="url(#winProbHomeFill)"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="awayWin"
                    name={awayName}
                    stroke="#38BDF8"
                    strokeWidth={2.2}
                    fill="url(#winProbAwayFill)"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="draw"
                    name={t.home.draw}
                    stroke="#94A3B8"
                    strokeWidth={1.4}
                    strokeDasharray="4 3"
                    fill="none"
                    isAnimationActive={false}
                  />

                  {/* Turning-point event markers on the curve */}
                  {turningPoints.map((tp, idx) => (
                    <ReferenceDot
                      key={`tp-${tp.minute}-${idx}`}
                      x={tp.minute}
                      y={Math.max(tp.homeWin, tp.awayWin)}
                      r={4}
                      fill="#F59E0B"
                      stroke="#090B0E"
                      strokeWidth={1.5}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Turning Point Events Strip */}
          {turningPoints.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-400">
              <span className="font-medium text-amber-300">
                {isFa ? 'نقاط عطف کلیدی:' : 'Key Shifts:'}
              </span>
              {turningPoints.slice(0, 5).map((tp, i) => (
                <React.Fragment key={`lbl-${tp.minute}-${i}`}>
                  {i > 0 && <span aria-hidden="true" className="text-slate-600">·</span>}
                  <span className="text-slate-300">
                    <strong className="font-mono tabular-nums text-white">{tp.minute}&apos;</strong>{' '}
                    {tp.eventLabel}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* AI Reasoning & Historical Edge Breakdown (Hairline-Divided, No Nested Cards) */}
          <div className="pt-4 border-t border-white/[0.06] grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
            {data.turningPointSummary && (
              <div className="space-y-1">
                <div className="font-semibold text-[#22FF66]">
                  {isFa ? 'تحلیل تغییر احتمال در جریان بازی' : 'In-Game Shift Read'}
                </div>
                <p className="text-slate-300">{data.turningPointSummary}</p>
              </div>
            )}

            {data.historicalEdgeNote && (
              <div className="space-y-1">
                <div className="font-semibold text-sky-400">
                  {isFa ? 'تأثیر فرم و عملکرد تاریخی تیم‌ها' : 'Historical Form & H2H Weight'}
                </div>
                <p className="text-slate-300">{data.historicalEdgeNote}</p>
              </div>
            )}
          </div>

          {data.keyDrivers.length > 0 && (
            <div className="pt-3 border-t border-white/[0.06] space-y-1.5">
              <div className="text-xs font-semibold text-slate-400">
                {isFa ? 'عوامل کلیدی مدل هوش مصنوعی' : 'Primary Probability Drivers'}
              </div>
              <ul className="space-y-1 text-xs text-slate-200">
                {data.keyDrivers.map((driver, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-mono tabular-nums text-[#22FF66]">0{idx + 1}.</span>
                    <span>{driver}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
