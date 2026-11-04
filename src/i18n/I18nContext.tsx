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

export const DICTIONARY_MAP_ZH: Record<string, string> = {
  // Accounts
  'US Bank Checking': '美国合众银行活期支票账户',
  'US Bank Savings': '美国合众银行高收益储蓄账户',
  'Interactive Brokers': '盈透证券综合投资账户 (IBKR Pro)',
  'Charles Schwab': '嘉信理财美股与ETF账户 (Schwab)',
  'European Bank Depot': '欧洲银行欧元金库与证券账户 (Depot)',
  'UK Bank (Simulated)': '英国银行英镑活期账户 (UK Bank)',
  'CMB China Checking': '招商银行一卡通人民币账户 (CMB)',
  'Bank of China (Hong Kong)': '中银香港跨境人民币结算账户',
  'Firstrade': '第一证券美股投资账户 (Firstrade)',
  'US Private Checking & Reserve (DEMO)': '合众银行私行支票储备账户 (演示)',
  'US High-Yield Treasury Savings (DEMO)': '合众银行高收益国债储蓄账户 (演示)',
  'IBKR Pro Multi-Asset Portfolio (DEMO)': '盈透证券多资产综合投资账户 (演示)',
  'Schwab US Long-Term Core Equity (DEMO)': '嘉信理财核心长线美股账户 (演示)',
  'Frankfurt Euro Treasury & Depot (DEMO)': '法兰克福欧元金库与托管账户 (演示)',
  'London Sterling Current Account (DEMO)': '伦敦英镑活期现汇账户 (演示)',
  'Firstrade International Equities (DEMO)': '第一证券国际股票交易账户 (演示)',
  'Cross-Border RMB Settlement & Liquidity (DEMO)': '跨境人民币流动性结算账户 (演示)',

  // Account & Transaction Types
  'Checking': '活期 / 支票账户',
  'Savings': '储蓄账户',
  'Brokerage': '券商证券账户',
  'Credit Card': '信用卡 / 授信',
  'Crypto Custody': '加密资产托管',
  'Buy': '买入证券',
  'Sell': '卖出证券',
  'Dividend': '现金股息 / 分红',
  'Interest': '利息收益',
  'Deposit': '资金存入 / 薪酬',
  'Withdrawal': '资金借记 / 支出',
  'Transfer': '内部划转',
  'FX Conversion': '外汇兑换',
  'Refund': '退款入账',
  'Tax': '税费缴纳',
  'Fee': '规费佣金',
  'Assistant Run': 'AI 助手任务',
  'Inflow': '资金流入',
  'Outflow': '资金流出',
  'Posted': '已入账',
  'Draft': '待审草稿',
  'Pending Approval': '待审批',
  'Flagged': '风控标记',
  'Settled': '已结算',
  'Rejected': '已驳回',
  'Approved': '已核准',
  'Pending': '待处理',

  // Asset Classes & Sectors
  'US Equities': '美股权益',
  'International Equities': '国际权益',
  'ETFs': '指数与大宗 ETF',
  'Bonds': '固定收益债券',
  'REITs': '不动产信托 REITs',
  'Crypto': '加密资产',
  'Other Assets': '其他另类资产',
  'Cash Reserves': '现金储备',
  'Investments': '证券投资',
  'Technology': '信息技术',
  'Financials': '金融服务',
  'Healthcare': '医疗健康',
  'Consumer Defensive': '必需消费',
  'Consumer Cyclical': '可选消费',
  'Communication Services': '通信服务',
  'Real Estate': '房地产',
  'Fixed Income': '固定收益',

  // Task Modes
  'Accounting': '复式记账模式',
  'Portfolio Analysis': '组合分析模式',
  'Research': '深度投研模式',
  'Quantitative Research': '量化回测模式',
  'Audit': '系统审计模式',
  'Risk Analysis': '风险风控模式',

  // Risk Levels
  'Low': '低风险',
  'Medium': '中风险',
  'High': '高风险',
  'Critical': '极高风险 / 阻断',

  // Audit Categories
  'Assistant Execution': 'AI 助手执行',
  'Account Sync': '账户数据同步',
  'API Access': 'API 访问调用',
  'Approval Decision': '人工审批决策',
  'Ledger Change': '账本分录变更',
  'Auth Event': '身份鉴权事件',
  'Security Warning': '安全合规预警',

  // Status & Directions
  'Active': '活跃连接',
  'Simulated': '模拟仿真',
  'Balanced': '借贷平衡',
  'Unbalanced': '借贷不平衡',
};

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
    if (typeof content === 'string') {
      if (locale === 'zh' && DICTIONARY_MAP_ZH[content]) {
        return DICTIONARY_MAP_ZH[content];
      }
      return content;
    }
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
