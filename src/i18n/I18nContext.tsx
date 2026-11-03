import React, { createContext, useContext, useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { en } from './locales/en';
import { zh } from './locales/zh';

export type Locale = 'en' | 'zh';
export type TranslationSchema = typeof en;

/**
 * Supports inline bilingual objects in Demo Adapter & simulated entities:
 * e.g., { en: "...", zh: "..." }
 */
export interface LocalizedText {
  en: string;
  zh: string;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (loc: Locale) => void;
  t: TranslationSchema;
  l: (content: string | LocalizedText | undefined | null) => string;
}

const dictionaries: Record<Locale, TranslationSchema> = { en, zh };
const STORAGE_KEY = 'ofinance_ui_locale';

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'en' || saved === 'zh' ? saved : 'en';
    } catch {
      return 'en';
    }
  });

  const setLocale = (loc: Locale) => {
    setLocaleState(loc);
    try {
      localStorage.setItem(STORAGE_KEY, loc);
    } catch {
      // ignore
    }
    document.documentElement.lang = loc === 'zh' ? 'zh-CN' : 'en-US';
  };

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en-US';
  }, [locale]);

  // Dynamically resolve bilingual strings while preserving raw English strings
  const l = (content: string | LocalizedText | undefined | null): string => {
    if (!content) return '';
    if (typeof content === 'string') return content;
    return content[locale] ?? content.en ?? '';
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: dictionaries[locale], l }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
};

/**
 * Segmented Locale Switcher component styled to match Base Currency [ USD | GBP | EUR | CNY ]
 */
export const LocaleSwitcher: React.FC = () => {
  const { locale, setLocale } = useI18n();

  return (
    <div
      title="UI Language: English / 简体中文"
      className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 text-xs font-mono shrink-0"
    >
      <span className="pl-1.5 pr-0.5 text-slate-400 dark:text-slate-500 flex items-center">
        <Globe className="w-3.5 h-3.5" />
      </span>
      <button
        type="button"
        aria-label="Switch UI to English"
        onClick={() => setLocale('en')}
        className={`px-2 py-1 text-[11px] font-mono font-medium rounded transition-colors ${
          locale === 'en'
            ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        aria-label="切换界面至简体中文"
        onClick={() => setLocale('zh')}
        className={`px-2 py-1 text-[11px] font-mono font-medium rounded transition-colors ${
          locale === 'zh'
            ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        中文
      </button>
    </div>
  );
};
