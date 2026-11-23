import React, { useState } from 'react';
import {
  Activity,
  Brain,
  History,
  Home,
  Languages,
  Menu,
  Newspaper,
  Settings2,
  Shield,
  Star,
  Trophy,
  UploadCloud,
  User,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { AppScreen, DataSourceMode, LocalizedText } from '../../types/football';
import { useLanguage } from '../../i18n/LanguageContext';
import { DataSourceNotice } from './DataSourceNotice';

interface AppShellProps {
  activeScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  liveCount: number;
  dataSource: DataSourceMode;
  disclaimer: LocalizedText;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeScreen,
  onNavigate,
  liveCount,
  dataSource,
  disclaimer,
  children,
}) => {
  const { lang, toggleLang, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sidebarItems: { id: AppScreen; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { id: 'home', label: t.nav.home, icon: Home },
    { id: 'live', label: t.nav.live, icon: Activity, count: liveCount > 0 ? liveCount : undefined },
    { id: 'past-matches', label: t.nav.pastMatches, icon: History },
    { id: 'leagues', label: t.nav.leagues, icon: Trophy },
    { id: 'teams', label: t.nav.teams, icon: Shield },
    { id: 'players', label: t.nav.players, icon: Users },
    { id: 'ai-lab', label: t.nav.aiLab, icon: Brain },
    { id: 'news', label: t.nav.news, icon: Newspaper },
    { id: 'favorites', label: t.nav.favorites, icon: Star },
    { id: 'profile', label: t.nav.profile, icon: User },
    { id: 'admin', label: t.nav.admin, icon: Settings2 },
  ];

  const topNavLinks: { id: AppScreen; label: string }[] = [
    { id: 'home', label: t.nav.home },
    { id: 'live', label: t.nav.live },
    { id: 'past-matches', label: t.nav.pastMatches },
    { id: 'leagues', label: t.nav.leagues },
    { id: 'teams', label: t.nav.teams },
  ];

  const mobileBottomTabs: { id: AppScreen; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: t.nav.home, icon: Home },
    { id: 'live', label: t.nav.live, icon: Activity },
    { id: 'past-matches', label: t.nav.pastMatches, icon: History },
    { id: 'leagues', label: t.nav.leagues, icon: Trophy },
    { id: 'ai-lab', label: t.nav.aiLab, icon: Brain },
  ];

  const handleSelect = (screen: AppScreen) => {
    onNavigate(screen);
    setMobileMenuOpen(false);
  };

  const handleOpenGitHubUpload = () => {
    onNavigate('admin');
    setMobileMenuOpen(false);
    setTimeout(() => {
      document.getElementById('github-upload-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
  };

  return (
    <div className="min-h-dvh w-full max-w-full overflow-x-clip bg-[#090B0E] text-[#F1F5F9] flex flex-col">
      {/* Top Bar: 3-Zone Contract on Desktop, Compact 52px App Bar on Mobile */}
      <header className="sticky top-0 z-30 h-[52px] lg:h-16 w-full bg-[#090B0E]/95 backdrop-blur-md border-b border-white/[0.07] pt-safe">
        <div className="h-full max-w-[1440px] mx-auto px-3.5 sm:px-6 flex items-center justify-between gap-3 lg:gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => handleSelect('home')}
            className="font-display text-lg lg:text-xl font-bold tracking-tight text-white hover:text-[#22FF66] transition-colors whitespace-nowrap shrink-0"
          >
            {t.brand}
          </button>

          {/* Zone 2: 5 clean single-line text nav links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-7" aria-label="Primary">
            {topNavLinks.map((link) => {
              const active = activeScreen === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleSelect(link.id)}
                  className={`py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    active
                      ? 'text-white border-[#22FF66]'
                      : 'text-slate-400 border-transparent hover:text-white hover:border-white/25'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Quick GitHub Upload + Primary Action (Desktop) / Menu trigger (Mobile) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenGitHubUpload}
              title={lang === 'fa' ? 'آپلود پروژه روی گیت‌هاب' : 'Upload project to GitHub'}
              className="min-h-[40px] px-2.5 sm:px-3.5 py-2 rounded-lg bg-[#12161B] border border-white/[0.1] hover:border-[#22FF66]/50 text-slate-200 hover:text-[#22FF66] text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <UploadCloud className="h-4 w-4 text-[#22FF66] shrink-0" />
              <span className="hidden sm:inline">
                {lang === 'fa' ? 'آپلود گیت‌هاب' : 'GitHub Upload'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelect('ai-lab')}
              className="hidden lg:inline-flex min-h-[40px] px-4 py-2 rounded-lg bg-[#22FF66] text-[#090B0E] text-xs font-semibold hover:bg-[#3bff77] transition-colors items-center whitespace-nowrap shrink-0"
            >
              {t.topBar.openAiLab}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden min-h-[44px] min-w-[44px] -me-1.5 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-[#181D24] transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto flex min-w-0">
        {/* Desktop Workspace Sidebar (240px) */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 border-e border-white/[0.07] bg-[#0B0E12] sticky top-16 h-[calc(100dvh-4rem)]">
          <div className="flex-1 overflow-y-auto py-5 px-3 space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const active =
                activeScreen === item.id ||
                (activeScreen === 'match-center' && item.id === 'live');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`w-full min-h-[42px] px-3 py-2 rounded-lg flex items-center justify-between gap-3 text-sm transition-colors ${
                    active
                      ? 'bg-[#181D24] text-white font-semibold'
                      : 'text-slate-400 hover:bg-[#12161B] hover:text-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        active ? 'text-[#22FF66]' : 'text-slate-500'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.count !== undefined && (
                    <span className="text-xs font-mono tabular-nums text-[#22FF66] font-semibold">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sidebar GitHub Upload & Language Switcher */}
          <div className="p-3 border-t border-white/[0.07] space-y-2">
            <button
              type="button"
              onClick={handleOpenGitHubUpload}
              className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#12161B] border border-[#22FF66]/30 hover:bg-[#181D24] text-xs font-semibold text-[#22FF66] flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2">
                <UploadCloud className="h-4 w-4 shrink-0" />
                <span>{lang === 'fa' ? 'آپلود روی گیت‌هاب' : 'Upload to GitHub'}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={toggleLang}
              className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-[#12161B] border border-white/[0.07] hover:bg-[#181D24] text-xs font-medium text-slate-200 flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-[#22FF66]" />
                <span>{lang === 'en' ? 'English · LTR' : 'فارسی · RTL'}</span>
              </span>
              <span className="text-slate-400 font-mono">
                {lang === 'en' ? 'FA' : 'EN'}
              </span>
            </button>
          </div>
        </aside>

        {/* Main Content Viewport with guaranteed mobile bottom-nav + safe-area clearance */}
        <main className="flex-1 min-w-0 w-full max-w-full px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 pb-mobile-nav lg:pb-10 space-y-5 sm:space-y-6">
          <DataSourceNotice dataSource={dataSource} disclaimer={disclaimer} />
          {children}
        </main>
      </div>

      {/* Mobile Fixed Bottom Tab Bar: always visible, safe-area aware, zero overlap */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 w-full bg-[#0B0E12]/98 backdrop-blur-md border-t border-white/[0.1] pb-safe shadow-[0_-6px_20px_rgba(0,0,0,0.45)]"
      >
        <div className="grid grid-cols-5 h-[58px] items-center px-1 max-w-lg mx-auto">
          {mobileBottomTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeScreen === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelect(tab.id)}
                className={`min-h-[48px] min-w-0 px-0.5 flex flex-col items-center justify-center gap-1 rounded-lg transition-colors ${
                  active ? 'text-[#22FF66]' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="h-[19px] w-[19px] shrink-0" />
                <span className="text-[10px] leading-none font-medium truncate max-w-full">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            />
            <motion.div
              initial={{ x: lang === 'fa' ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: lang === 'fa' ? '100%' : '-100%' }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-72 max-w-[85vw] bg-[#0B0E12] border-e border-white/[0.08] h-full flex flex-col"
            >
              <div className="h-14 px-4 flex items-center justify-between border-b border-white/[0.07]">
                <span className="font-display font-bold text-white">{t.brand}</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label={t.common.close}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeScreen === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      className={`w-full min-h-[44px] px-3 py-2.5 rounded-lg flex items-center justify-between text-sm transition-colors ${
                        active
                          ? 'bg-[#181D24] text-white font-semibold'
                          : 'text-slate-300 hover:bg-[#12161B]'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 ${active ? 'text-[#22FF66]' : 'text-slate-500'}`} />
                        <span>{item.label}</span>
                      </span>
                      {item.count !== undefined && (
                        <span className="text-xs font-mono tabular-nums text-[#22FF66]">
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="p-4 border-t border-white/[0.07] space-y-2.5">
                <button
                  type="button"
                  onClick={handleOpenGitHubUpload}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-[#12161B] border border-[#22FF66]/35 text-sm font-semibold text-[#22FF66] flex items-center gap-2"
                >
                  <UploadCloud className="h-4 w-4 shrink-0" />
                  <span>{lang === 'fa' ? 'آپلود روی گیت‌هاب' : 'Upload to GitHub'}</span>
                </button>
                <button
                  type="button"
                  onClick={toggleLang}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-[#12161B] border border-white/[0.08] text-sm font-medium text-white flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Languages className="h-4 w-4 text-[#22FF66]" />
                    <span>{lang === 'en' ? 'Switch to فارسی (RTL)' : 'Switch to English (LTR)'}</span>
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
