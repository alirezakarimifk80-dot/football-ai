import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Database,
  Loader2,
  Play,
  PlugZap,
  RefreshCw,
  ShieldAlert,
  Square,
  Trash2,
} from 'lucide-react';
import type {
  EndpointModuleKey,
  ProviderConnectionTestResult,
  ProviderId,
} from '../../../backend/src/types/football';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  formatUtcToLocalDateTime,
  liveFootballApiService,
  type AdminApiDiagnostics,
} from '../../services/liveFootballApiService';

const ENDPOINT_LABELS: Record<EndpointModuleKey, { en: string; fa: string }> = {
  live: { en: 'Live Scores', fa: 'نتایج زنده' },
  fixtures: { en: 'Fixtures', fa: 'برنامه بازی‌ها' },
  events: { en: 'Match Events', fa: 'رویدادهای بازی' },
  statistics: { en: 'Statistics', fa: 'آمار مسابقه' },
  lineups: { en: 'Lineups', fa: 'ترکیب تیم‌ها' },
  h2h: { en: 'Head-to-Head', fa: 'رویارویی‌ها' },
  leagues: { en: 'Leagues', fa: 'لیگ‌ها' },
  standings: { en: 'Standings', fa: 'جدول رده‌بندی' },
  topScorers: { en: 'Top Scorers', fa: 'برترین گلزنان' },
  topAssists: { en: 'Top Assists', fa: 'برترین پاسورها' },
  teams: { en: 'Teams & Squads', fa: 'تیم‌ها و ترکیب' },
  players: { en: 'Players', fa: 'بازیکنان' },
  coaches: { en: 'Coaches', fa: 'مربیان' },
  transfers: { en: 'Transfers', fa: 'نقل‌وانتقالات' },
  injuries: { en: 'Injuries', fa: 'مصدومیت‌ها' },
  predictions: { en: 'Predictions', fa: 'پیش‌بینی‌ها' },
};

export const ApiManagementSection: React.FC = () => {
  const { lang } = useLanguage();
  const isFa = lang === 'fa';

  const [diag, setDiag] = useState<AdminApiDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ProviderConnectionTestResult | null>(null);
  const [pollInput, setPollInput] = useState<number>(60);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadDiagnostics = useCallback(async () => {
    try {
      const data = await liveFootballApiService.getAdminDiagnostics();
      setDiag(data);
      setPollInput(data.liveEngine.pollIntervalSec);
      if (data.lastConnectionTest) {
        setTestResult(data.lastConnectionTest);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to load API diagnostics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDiagnostics();
  }, [loadDiagnostics]);

  const handleTestConnection = async () => {
    setTesting(true);
    setActionError(null);
    setActionMsg(null);
    try {
      const res = await liveFootballApiService.testConnection();
      setTestResult(res);
      await loadDiagnostics();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSelectProvider = async (providerId: ProviderId) => {
    setActionError(null);
    setActionMsg(null);
    try {
      const res = await liveFootballApiService.selectProvider(providerId);
      setActionMsg(res.message);
      await loadDiagnostics();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to switch provider');
    }
  };

  const handleToggleEndpoint = async (moduleKey: EndpointModuleKey, enabled: boolean) => {
    setActionError(null);
    try {
      const res = await liveFootballApiService.toggleEndpoint(moduleKey, enabled);
      setDiag((prev) => (prev ? { ...prev, enabledEndpoints: res.enabledEndpoints } : prev));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update endpoint switch');
    }
  };

  const handleClearCache = async () => {
    setActionError(null);
    try {
      const res = await liveFootballApiService.clearCache();
      setActionMsg(
        isFa
          ? `${res.clearedEntries} رکورد از کش سرور پاک شد.`
          : `Cleared ${res.clearedEntries} cached entries on server.`
      );
      await loadDiagnostics();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to clear cache');
    }
  };

  const handleEngineControl = async (action?: 'start' | 'stop' | 'poll_now') => {
    setActionError(null);
    setActionMsg(null);
    try {
      const res = await liveFootballApiService.controlLiveEngine({
        action,
        pollIntervalSec: pollInput,
      });
      setDiag((prev) => (prev ? { ...prev, liveEngine: res.liveEngine } : prev));
      setActionMsg(
        isFa
          ? `وضعیت موتور زنده به‌روزرسانی شد (${res.liveEngine.pollingState}).`
          : `Live Score Engine updated (${res.liveEngine.pollingState}).`
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Live engine command failed');
    }
  };

  if (loading || !diag) {
    return (
      <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] p-6 flex items-center gap-3 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin text-[#22FF66]" />
        <span>{isFa ? 'در حال بارگذاری وضعیت API فوتبال...' : 'Loading Football Live Data API diagnostics...'}</span>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-hidden">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-white">
            <PlugZap className="h-5 w-5 text-[#22FF66] shrink-0" />
            <span className="break-words">
              {isFa
                ? 'مدیریت API داده‌های زنده فوتبال (API-Football v3)'
                : 'Football Live Data API Management (API-Football v3)'}
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {isFa
              ? 'پروکسی امن سمت سرور، کنترل سهمیه رایگان، کش اشتراکی و موتور SSE نتایج زنده. کلید API هرگز به مرورگر ارسال نمی‌شود.'
              : 'Server-side proxy, free-plan quota guard, shared cache, and SSE live score engine. Secret keys stay strictly in server environment variables.'}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            disabled={testing}
            onClick={handleTestConnection}
            className="min-h-[42px] px-3 sm:px-4 py-2 rounded-lg bg-[#22FF66] text-[#090B0E] text-xs font-semibold hover:bg-[#3bff77] disabled:opacity-60 inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap min-w-0"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <PlugZap className="h-4 w-4 shrink-0" />}
            <span className="truncate">{isFa ? 'تست اتصال واقعی' : 'Test Connection'}</span>
          </button>
          <button
            type="button"
            onClick={loadDiagnostics}
            className="min-h-[42px] px-3 py-2 rounded-lg bg-[#181D24] border border-white/[0.08] text-xs font-medium text-slate-200 hover:text-white inline-flex items-center justify-center gap-1.5 whitespace-nowrap min-w-0"
          >
            <RefreshCw className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{isFa ? 'بروزرسانی' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Connection Test Result Banner */}
      {testResult && (
        <div
          className={`p-4 rounded-xl border text-xs space-y-1 ${
            testResult.connected
              ? 'bg-[#22FF66]/10 border-[#22FF66]/35 text-[#22FF66]'
              : 'bg-sky-500/10 border-sky-500/35 text-sky-200'
          }`}
        >
          <div className="font-semibold">
            {testResult.connected
              ? isFa
                ? `اتصال موفق به ${testResult.provider} (${testResult.plan ?? 'Active'})`
                : `Verified connection to ${testResult.provider} (${testResult.plan ?? 'Active'})`
              : isFa
                ? 'فید زنده پیش‌فرض فعال است — کلید اختیاری API-Football v3 تنظیم نشده'
                : 'Built-in Live Feed Active — Optional API-Football v3 key not set'}
          </div>
          {testResult.error && <p className="text-sky-100/90">{testResult.error}</p>}
          {testResult.connected && (
            <div className="font-mono tabular-nums text-slate-200">
              Account: {testResult.accountName ?? 'Verified'} · Requests Today:{' '}
              {testResult.requestsToday ?? 0} / {testResult.dailyLimit ?? 100} (Remaining:{' '}
              {testResult.remainingToday ?? 'N/A'})
            </div>
          )}
        </div>
      )}

      {actionMsg && (
        <div className="px-4 py-2.5 rounded-lg bg-[#22FF66]/10 border border-[#22FF66]/30 text-xs text-[#22FF66]">
          {actionMsg}
        </div>
      )}
      {actionError && (
        <div className="px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-200">
          {actionError}
        </div>
      )}

      {/* Quota, Rate Limit, Cache & Live Engine KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-[#090B0E] border border-white/[0.06]">
          <div className="text-[11px] text-slate-400">
            {isFa ? 'وضعیت کلید API سرور' : 'Server API Key'}
          </div>
          <div
            className={`text-sm font-mono font-semibold mt-1 truncate ${
              diag.apiKeyStatus.configured ? 'text-[#22FF66]' : 'text-amber-400'
            }`}
          >
            {diag.apiKeyStatus.configured ? diag.apiKeyStatus.masked : isFa ? 'تنظیم‌نشده' : 'Unset'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">ENV: API_FOOTBALL_KEY</div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#090B0E] border border-white/[0.06]">
          <div className="text-[11px] text-slate-400">
            {isFa ? 'درخواست امروز / باقیمانده' : 'Daily Quota Used / Left'}
          </div>
          <div className="text-lg font-mono font-bold tabular-nums text-white mt-1">
            {diag.quota.requestsToday} / {diag.quota.remainingToday}
          </div>
          <div className="text-[10px] font-mono tabular-nums text-slate-500 mt-0.5">
            Limit: {diag.quota.dailyLimit}/day
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#090B0E] border border-white/[0.06]">
          <div className="text-[11px] text-slate-400">
            {isFa ? 'نرخ دقیقه اخیر' : 'Requests / Minute'}
          </div>
          <div className="text-lg font-mono font-bold tabular-nums text-white mt-1">
            {diag.quota.requestsLastMinute} / {diag.quota.perMinuteLimit}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {diag.quota.isBackoffActive ? '429 Backoff Active' : 'Nominal'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#090B0E] border border-white/[0.06]">
          <div className="text-[11px] text-slate-400">
            {isFa ? 'وضعیت کش سرور' : 'Shared Server Cache'}
          </div>
          <div className="text-lg font-mono font-bold tabular-nums text-[#22FF66] mt-1">
            {diag.cache.hitRatePercent}%
          </div>
          <div className="text-[10px] font-mono tabular-nums text-slate-500 mt-0.5">
            {diag.cache.entries} keys · {diag.cache.inFlightDeduplicated} deduped
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#090B0E] border border-white/[0.06] col-span-2 lg:col-span-1">
          <div className="text-[11px] text-slate-400">
            {isFa ? 'آخرین همگام‌سازی موفق' : 'Last Successful Sync'}
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-200 mt-1.5">
            {formatUtcToLocalDateTime(diag.quota.lastSuccessfulSyncUtc, lang)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Local browser timezone</div>
        </div>
      </div>

      {/* Provider Selector + Live Engine Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Provider Abstraction Selector */}
        <div className="p-4 rounded-xl bg-[#090B0E] border border-white/[0.06] space-y-3">
          <div className="text-xs font-semibold text-slate-200">
            {isFa ? 'انتخاب ارائه‌دهنده داده فوتبال' : 'Data Provider Registry'}
          </div>
          <div className="divide-y divide-white/[0.05]">
            {diag.providers.map((p) => {
              const isActive = p.id === diag.activeProvider;
              return (
                <div
                  key={p.id}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white">
                      {p.displayName}
                      {isActive && (
                        <span className="ms-2 text-[#22FF66] font-mono">
                          · {isFa ? 'فعال' : 'Active'}
                        </span>
                      )}
                    </div>
                    <div className="text-slate-500 truncate mt-0.5">
                      {p.implemented
                        ? p.verified
                          ? isFa
                            ? 'تأییدشده و آماده'
                            : 'Verified & ready'
                          : p.configured
                            ? isFa
                              ? 'کلید موجود — نیاز به تست اتصال'
                              : 'Key detected — run Connection Test'
                            : isFa
                              ? 'کلید در سرور تنظیم نشده (تنظیم در Settings > Secrets)'
                              : 'Set API_FOOTBALL_KEY in Settings > Secrets'
                        : isFa
                          ? 'آداپتور آماده توسعه آینده (تأییدنشده)'
                          : 'Future adapter scaffold (unverified)'}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isActive}
                    onClick={() => handleSelectProvider(p.id)}
                    className="min-h-[36px] px-3 py-1 rounded-md border border-white/[0.1] bg-[#12161B] text-slate-300 hover:text-white disabled:opacity-40 whitespace-nowrap shrink-0"
                  >
                    {isActive ? (isFa ? 'منتخب' : 'Selected') : isFa ? 'انتخاب' : 'Select'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Score Engine + Cache Control */}
        <div className="p-4 rounded-xl bg-[#090B0E] border border-white/[0.06] space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 min-w-0">
              <Activity className="h-4 w-4 text-[#22FF66] shrink-0" />
              <span className="truncate">{isFa ? 'موتور زنده SSE و کنترل کش' : 'Live Score Engine (SSE) & Cache'}</span>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
              {diag.liveEngine.connectedClients} SSE · {diag.liveEngine.pollingState}
            </span>
          </div>

          <div className="space-y-2.5 sm:space-y-0 sm:flex sm:flex-wrap sm:items-end gap-2">
            <label className="block space-y-1">
              <span className="block text-[11px] text-slate-400">
                {isFa ? 'بازه Polling (ثانیه)' : 'Poll Interval (sec)'}
              </span>
              <input
                type="number"
                min={15}
                max={600}
                value={pollInput}
                onChange={(e) => setPollInput(Number(e.target.value))}
                className="w-full sm:w-28 min-h-[40px] px-3 rounded-lg bg-[#12161B] border border-white/[0.1] font-mono text-xs text-white"
              />
            </label>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleEngineControl('start')}
                className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[#181D24] border border-[#22FF66]/40 text-[#22FF66] text-xs font-medium inline-flex items-center justify-center gap-1.5"
              >
                <Play className="h-3.5 w-3.5 shrink-0" />
                <span>{isFa ? 'شروع' : 'Start'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleEngineControl('stop')}
                className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[#181D24] border border-white/[0.1] text-slate-300 hover:text-white text-xs font-medium inline-flex items-center justify-center gap-1.5"
              >
                <Square className="h-3.5 w-3.5 shrink-0" />
                <span>{isFa ? 'توقف' : 'Stop'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleEngineControl('poll_now')}
                className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[#181D24] border border-white/[0.1] text-slate-200 hover:text-white text-xs font-medium inline-flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                <span>{isFa ? 'همگام‌سازی' : 'Poll Now'}</span>
              </button>
              <button
                type="button"
                onClick={handleClearCache}
                className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[#181D24] border border-white/[0.1] text-slate-300 hover:text-red-300 text-xs font-medium inline-flex items-center justify-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                <span>{isFa ? 'پاکسازی کش' : 'Clear Cache'}</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <Database className="h-3.5 w-3.5 shrink-0" />
            <span>
              {isFa
                ? 'در صورت نبود بازی زنده، Polling به‌صورت خودکار متوقف می‌شود تا سهمیه رایگان هدر نرود.'
                : 'Polling automatically idles when 0 live matches are active to protect free-tier quota.'}
            </span>
          </div>
        </div>
      </div>

      {/* Enabled / Disabled API Endpoints */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-slate-200">
          {isFa ? 'مدیریت فعال/غیرفعال‌سازی ماژول‌های API' : 'Enabled & Disabled API Endpoints'}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.keys(ENDPOINT_LABELS) as EndpointModuleKey[]).map((key) => {
            const enabled = diag.enabledEndpoints[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleToggleEndpoint(key, !enabled)}
                className={`min-h-[40px] px-2.5 sm:px-3 py-2 rounded-lg border text-[11px] sm:text-xs font-medium flex items-center justify-between gap-1.5 sm:gap-2 transition-colors min-w-0 ${
                  enabled
                    ? 'bg-[#090B0E] border-[#22FF66]/35 text-slate-100'
                    : 'bg-[#090B0E]/60 border-white/[0.06] text-slate-500'
                }`}
              >
                <span className="truncate">{isFa ? ENDPOINT_LABELS[key].fa : ENDPOINT_LABELS[key].en}</span>
                <span className={`font-mono text-[10px] shrink-0 ${enabled ? 'text-[#22FF66]' : 'text-slate-600'}`}>
                  {enabled ? 'ON' : 'OFF'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Provider Errors */}
      {diag.quota.recentErrors.length > 0 && (
        <div className="p-4 rounded-xl bg-[#090B0E] border border-red-500/25 space-y-2 overflow-hidden">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-300">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{isFa ? 'خطاهای اخیر ارائه‌دهنده' : 'Recent Provider Errors'}</span>
          </div>
          <div className="divide-y divide-white/[0.05] text-xs font-mono">
            {diag.quota.recentErrors.slice(0, 5).map((err, i) => (
              <div key={i} className="py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 text-slate-300 min-w-0">
                <span className="break-all sm:break-words min-w-0">
                  [{err.statusCode ?? 'ERR'}] {err.endpoint}: {err.message}
                </span>
                <span className="text-slate-500 shrink-0 text-[11px]">
                  {formatUtcToLocalDateTime(err.timestampUtc, lang)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
