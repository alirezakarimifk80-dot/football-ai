import React, { useEffect, useState } from 'react';
import { Loader2, Radio, RefreshCw, ShieldCheck } from 'lucide-react';
import type { Match, NewsArticle, SystemCapabilities, Team } from '../types/football';
import { useLanguage } from '../i18n/LanguageContext';
import { footballService } from '../services/footballService';
import { ApiManagementSection } from '../components/admin/ApiManagementSection';
import { GitHubUploadSection } from '../components/admin/GitHubUploadSection';

interface AdminDashboardPageProps {
  matches: Match[];
  teams: Team[];
  onRefreshLive: () => Promise<void>;
  refreshingLive: boolean;
  onNewsPublished: (article: NewsArticle) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  matches,
  teams,
  onRefreshLive,
  refreshingLive,
  onNewsPublished,
}) => {
  const { t, lang } = useLanguage();
  const isFa = lang === 'fa';

  const [capabilities, setCapabilities] = useState<SystemCapabilities | null>(null);
  const [newsCategory, setNewsCategory] = useState<NewsArticle['category']>('tactics');
  const [titleEn, setTitleEn] = useState('');
  const [titleFa, setTitleFa] = useState('');
  const [summaryEn, setSummaryEn] = useState('');
  const [summaryFa, setSummaryFa] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  useEffect(() => {
    footballService
      .getCapabilities()
      .then(setCapabilities)
      .catch(() => setCapabilities(null));
  }, [matches.length]);

  const liveNowCount = matches.filter((m) => m.status === 'LIVE' || m.status === 'HT').length;

  const handlePublishNews = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishing(true);
    setAdminError(null);
    try {
      const res = await footballService.publishEditorialNews({
        category: newsCategory,
        titleEn,
        titleFa: titleFa || titleEn,
        summaryEn,
        summaryFa: summaryFa || summaryEn,
      });
      onNewsPublished(res.data);
      setTitleEn('');
      setTitleFa('');
      setSummaryEn('');
      setSummaryFa('');
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Failed to publish brief');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-full min-w-0">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">{t.adminPage.title}</h1>
        <p className="text-xs sm:text-sm text-slate-400">{t.adminPage.subtitle}</p>
      </div>

      {/* Direct GitHub Upload Publisher */}
      <GitHubUploadSection />

      {/* Live Football Data API Management Console */}
      <ApiManagementSection />

      {/* Read-Only Server Integration Status */}
      <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <ShieldCheck className="h-4 w-4 text-[#22FF66]" />
          <span>{t.adminPage.providerStatus}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#090B0E] border border-white/[0.06] space-y-1">
            <div className="text-xs text-slate-400">{t.adminPage.geminiService}</div>
            <div
              className={`text-sm font-semibold ${
                capabilities?.geminiConfigured ? 'text-[#22FF66]' : 'text-amber-400'
              }`}
            >
              {capabilities?.geminiConfigured ? t.adminPage.configured : t.adminPage.notConfigured}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#090B0E] border border-white/[0.06] space-y-1">
            <div className="text-xs text-slate-400">{t.adminPage.footballApi}</div>
            <div className="text-sm font-semibold text-[#22FF66]">
              {isFa ? 'متصل به داده‌های واقعی و زنده' : 'Live Real-Time Feed Active'}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#090B0E] border border-white/[0.06] space-y-1">
            <div className="text-xs text-slate-400">{t.adminPage.aiRequestsLogged}</div>
            <div className="text-xl font-mono font-bold tabular-nums text-white">
              {capabilities?.aiRequestsCount ?? 0}
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500">{t.adminPage.securityNote}</p>
      </section>

      {adminError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-200">
          {adminError}
        </div>
      )}

      {/* Two-Column Admin Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        {/* Live Feed Sync Controller (replaces Demo Score Editor) */}
        <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] p-4 sm:p-5 space-y-4 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 text-base font-bold text-white">
            <Radio className="h-4 w-4 text-[#22FF66]" />
            <span>{isFa ? 'وضعیت فید واقعی مسابقات' : 'Live Football Feed Sync'}</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {isFa
              ? 'حالت دمو غیرفعال شده است. تمام نتایج، ترکیب‌ها، جدول لیگ‌ها و آمارها به‌صورت مستقیم از سرورهای رسمی داده‌های فوتبال همگام‌سازی می‌شوند و قابل ویرایش دستی نیستند.'
              : 'Demo mode is disabled. All fixtures, live scores, league standings, lineups, and news are synced directly from real-time football data feeds and cannot be manually spoofed.'}
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-[#090B0E] border border-white/[0.06]">
              <div className="text-[11px] text-slate-400">{isFa ? 'بازی زنده' : 'Live Now'}</div>
              <div className="text-xl font-mono font-bold tabular-nums text-[#22FF66] mt-0.5">
                {liveNowCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#090B0E] border border-white/[0.06]">
              <div className="text-[11px] text-slate-400">{isFa ? 'مسابقات فعال' : 'Fixtures'}</div>
              <div className="text-xl font-mono font-bold tabular-nums text-white mt-0.5">
                {matches.length}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#090B0E] border border-white/[0.06]">
              <div className="text-[11px] text-slate-400">{isFa ? 'باشگاه‌ها' : 'Clubs'}</div>
              <div className="text-xl font-mono font-bold tabular-nums text-white mt-0.5">
                {teams.length}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={refreshingLive}
            onClick={onRefreshLive}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-lg bg-[#22FF66] text-[#090B0E] text-sm font-semibold hover:bg-[#3bff77] disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshingLive ? 'animate-spin' : ''}`} />
            <span>{isFa ? 'همگام‌سازی فوری داده‌های زنده' : 'Force Sync Live Feed'}</span>
          </button>
        </section>

        {/* Editorial Newsroom Publisher */}
        <form
          onSubmit={handlePublishNews}
          className="rounded-2xl bg-[#12161B] border border-white/[0.07] p-4 sm:p-5 space-y-4 min-w-0 overflow-hidden"
        >
          <h2 className="text-base font-bold text-white">{t.adminPage.newsPublisher}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">{t.adminPage.headlineEn}</span>
              <input
                type="text"
                required
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-lg bg-[#090B0E] border border-white/[0.1] text-sm text-white"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">{t.adminPage.headlineFa}</span>
              <input
                type="text"
                dir="rtl"
                value={titleFa}
                onChange={(e) => setTitleFa(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-lg bg-[#090B0E] border border-white/[0.1] text-sm text-white"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">{t.adminPage.summaryEn}</span>
              <textarea
                required
                rows={2}
                value={summaryEn}
                onChange={(e) => setSummaryEn(e.target.value)}
                className="w-full p-3 rounded-lg bg-[#090B0E] border border-white/[0.1] text-sm text-white"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">{t.adminPage.summaryFa}</span>
              <textarea
                dir="rtl"
                rows={2}
                value={summaryFa}
                onChange={(e) => setSummaryFa(e.target.value)}
                className="w-full p-3 rounded-lg bg-[#090B0E] border border-white/[0.1] text-sm text-white"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center justify-between gap-3">
            <select
              value={newsCategory}
              onChange={(e) => setNewsCategory(e.target.value as NewsArticle['category'])}
              className="w-full sm:w-auto min-h-[42px] px-3 rounded-lg bg-[#090B0E] border border-white/[0.1] text-sm text-white"
            >
              <option value="tactics">{t.newsPage.tactics}</option>
              <option value="match-report">{t.newsPage['match-report']}</option>
              <option value="analytics">{t.newsPage.analytics}</option>
              <option value="transfers">{t.newsPage.transfers}</option>
            </select>

            <button
              type="submit"
              disabled={publishing}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-lg bg-[#181D24] border border-[#22FF66]/45 text-[#22FF66] text-sm font-semibold hover:bg-[#22FF66] hover:text-[#090B0E] transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {publishing && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{t.adminPage.publishCta}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
