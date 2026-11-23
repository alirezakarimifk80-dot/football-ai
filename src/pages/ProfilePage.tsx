import React, { useState } from 'react';
import { Languages, Smartphone } from 'lucide-react';
import type { UserPreferences } from '../types/football';
import { useLanguage } from '../i18n/LanguageContext';

interface ProfilePageProps {
  prefs: UserPreferences;
  onUpdatePrefs: (next: UserPreferences) => void;
  onResetPrefs: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  prefs,
  onUpdatePrefs,
  onResetPrefs,
}) => {
  const { lang, setLang, t } = useLanguage();
  const [savedBanner, setSavedBanner] = useState(false);

  const applyChange = (patch: Partial<UserPreferences>) => {
    onUpdatePrefs({ ...prefs, ...patch });
    setSavedBanner(true);
    window.setTimeout(() => setSavedBanner(false), 2000);
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-3xl w-full min-w-0">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">{t.profilePage.title}</h1>
        <p className="text-xs sm:text-sm text-slate-400">{t.profilePage.subtitle}</p>
      </div>

      {savedBanner && (
        <div className="px-4 py-2.5 rounded-lg bg-[#22FF66]/10 border border-[#22FF66]/35 text-xs text-[#22FF66] font-medium">
          {t.profilePage.savedNotice}
        </div>
      )}

      {/* Language & Direction */}
      <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-[#22FF66]" />
          <h2 className="text-sm font-bold text-white">{t.profilePage.languageSection}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`min-h-[48px] px-4 py-3 rounded-xl border text-sm font-semibold text-start transition-colors ${
              lang === 'en'
                ? 'bg-[#22FF66] text-[#090B0E] border-[#22FF66]'
                : 'bg-[#090B0E] text-slate-300 border-white/[0.08] hover:text-white'
            }`}
          >
            {t.profilePage.englishLtr}
          </button>
          <button
            type="button"
            onClick={() => setLang('fa')}
            className={`min-h-[48px] px-4 py-3 rounded-xl border text-sm font-semibold text-start transition-colors ${
              lang === 'fa'
                ? 'bg-[#22FF66] text-[#090B0E] border-[#22FF66]'
                : 'bg-[#090B0E] text-slate-300 border-white/[0.08] hover:text-white'
            }`}
          >
            {t.profilePage.persianRtl}
          </button>
        </div>
      </section>

      {/* Display & Alerts Preferences */}
      <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] p-4 sm:p-5 divide-y divide-white/[0.06]">
        <div className="pb-4 space-y-3">
          <h2 className="text-sm font-bold text-white">{t.profilePage.displaySection}</h2>
          <label className="flex items-center justify-between gap-4 py-1.5 cursor-pointer">
            <span className="text-sm text-slate-300">{t.profilePage.showXg}</span>
            <input
              type="checkbox"
              checked={prefs.showXgOnCards}
              onChange={(e) => applyChange({ showXgOnCards: e.target.checked })}
              className="h-5 w-5 accent-[#22FF66] rounded shrink-0"
            />
          </label>
          <label className="flex items-center justify-between gap-4 py-1.5 cursor-pointer">
            <span className="text-sm text-slate-300">{t.profilePage.compactRows}</span>
            <input
              type="checkbox"
              checked={prefs.compactMatchRows}
              onChange={(e) => applyChange({ compactMatchRows: e.target.checked })}
              className="h-5 w-5 accent-[#22FF66] rounded shrink-0"
            />
          </label>
        </div>

        <div className="pt-4 space-y-3">
          <h2 className="text-sm font-bold text-white">{t.profilePage.alertsSection}</h2>
          <label className="flex items-center justify-between gap-4 py-1.5 cursor-pointer">
            <span className="text-sm text-slate-300">{t.profilePage.liveGoalAlerts}</span>
            <input
              type="checkbox"
              checked={prefs.liveGoalAlerts}
              onChange={(e) => applyChange({ liveGoalAlerts: e.target.checked })}
              className="h-5 w-5 accent-[#22FF66] rounded shrink-0"
            />
          </label>
          <label className="flex items-center justify-between gap-4 py-1.5 cursor-pointer">
            <span className="text-sm text-slate-300">{t.profilePage.aiInsightAlerts}</span>
            <input
              type="checkbox"
              checked={prefs.aiInsightAlerts}
              onChange={(e) => applyChange({ aiInsightAlerts: e.target.checked })}
              className="h-5 w-5 accent-[#22FF66] rounded shrink-0"
            />
          </label>
        </div>
      </section>

      {/* Capacitor Architecture Note */}
      <section className="rounded-2xl bg-[#12161B] border border-white/[0.07] p-4 sm:p-5 space-y-2">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Smartphone className="h-4 w-4 text-[#22FF66] shrink-0" />
          <span>{t.profilePage.mobileReadiness}</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {t.profilePage.mobileReadinessDesc}
        </p>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onResetPrefs}
          className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-lg bg-[#181D24] border border-white/[0.1] text-xs font-medium text-slate-300 hover:text-white"
        >
          {t.profilePage.resetDefaults}
        </button>
      </div>
    </div>
  );
};
