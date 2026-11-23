import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Language, LocalizedText } from '../types/football';
import { translations, pickText } from './translations';

interface LanguageContextValue {
  lang: Language;
  isRtl: boolean;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (typeof translations)[Language];
  localize: (text: LocalizedText) => string;
}

const STORAGE_KEY = 'football_ai_lang';

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved === 'fa' ? 'fa' : 'en';
    } catch {
      return 'en';
    }
  });

  const isRtl = lang === 'fa';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore storage write errors in restricted environments
    }
  }, [lang, isRtl]);

  const setLang = (next: Language) => setLangState(next);
  const toggleLang = () => setLangState((prev) => (prev === 'en' ? 'fa' : 'en'));
  const localize = (text: LocalizedText) => pickText(text, lang);

  return (
    <LanguageContext.Provider
      value={{
        lang,
        isRtl,
        setLang,
        toggleLang,
        t: translations[lang],
        localize,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
