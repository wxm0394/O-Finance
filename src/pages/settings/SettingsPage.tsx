import React, { useState } from 'react';
import { useOFinance } from '../../app/providers/OFinanceContext';
import { useI18n } from '../../i18n';
import { CurrencyCode } from '../../types';
import { Save, RotateCcw, HardDrive, Shield, Server, Info, AlertTriangle, Globe } from 'lucide-react';
import { ApiClient } from '../../services/api/client';

export const SettingsPage: React.FC = () => {
  const { locale, setLocale, t } = useI18n();
  const { settings, updateSettings, showToast } = useOFinance();

  const [formState, setFormState] = useState(settings);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formState);
    showToast(t.settings.saveToast, 'success');
  };

  const handleResetDemo = () => {
    localStorage.removeItem('ofinance_demo_settings_v1');
    showToast(t.settings.resetToast, 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
            {t.settings.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.settings.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDemo}
            className="px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.settings.resetBtn}</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{t.settings.saveBtn}</span>
          </button>
        </div>
      </div>

      {/* Runtime Architecture Status Banner */}
      <div
        className={`p-4 rounded border text-xs ${
          ApiClient.isDemoMode
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
        }`}
      >
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold font-mono">
              <span>
                {locale === 'zh' ? '当前运行时:' : 'ACTIVE RUNTIME:'}{' '}
                {ApiClient.isDemoMode
                  ? locale === 'zh'
                    ? '演示适配器 (内存纯前端仿真)'
                    : 'DEMO ADAPTER (IN-MEMORY SIMULATION)'
                  : locale === 'zh'
                  ? '本地 FASTAPI (已连接)'
                  : 'LOCAL FASTAPI (CONNECTED)'}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40">
                {ApiClient.isDemoMode
                  ? locale === 'zh'
                    ? '无真实外部网络请求'
                    : 'NO NETWORK REQUESTS'
                  : locale === 'zh'
                  ? '实时 REST 通信'
                  : 'LIVE REST CALLS'}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {ApiClient.isDemoMode ? (
                locale === 'zh' ? (
                  <>
                    工作站当前处于<strong>演示模式</strong> (
                    <code className="font-mono">VITE_DEMO_MODE !== 'false'</code>
                    )。所有财务数据查询与 AI 助手任务均在确定性纯前端内存 Demo
                    Adapter 中运行，消耗 0 真实 Token。如需切换至本地 FastAPI
                    后端，请在环境变量中设置{' '}
                    <code className="font-mono">VITE_DEMO_MODE=false</code> 与{' '}
                    <code className="font-mono">
                      VITE_API_BASE_URL=http://127.0.0.1:8000
                    </code>
                    。
                  </>
                ) : (
                  <>
                    The workstation is running in <strong>Demo Mode</strong> (
                    <code className="font-mono">VITE_DEMO_MODE !== 'false'</code>
                    ). All assistant executions and financial queries run
                    against the in-memory deterministic Demo Adapter with 0
                    real tokens billed. To switch to your local FastAPI backend,
                    set <code className="font-mono">VITE_DEMO_MODE=false</code>{' '}
                    and{' '}
                    <code className="font-mono">
                      VITE_API_BASE_URL=http://127.0.0.1:8000
                    </code>{' '}
                    in your environment.
                  </>
                )
              ) : locale === 'zh' ? (
                <>
                  已连接至本地 Python FastAPI 后端 (
                  <code className="font-mono">{ApiClient.baseUrl}</code>
                  )。所有记账流水与 AI 助手任务均通过本地 HTTP 守护进程调度执行。
                </>
              ) : (
                <>
                  Connected to local Python FastAPI backend at{' '}
                  <code className="font-mono">{ApiClient.baseUrl}</code>. All
                  financial and assistant tasks are dispatched over HTTP to your
                  local workstation daemon.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
        {/* 1. General, Appearance & Currency Settings (6 cols) */}
        <div className="lg:col-span-6 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
            {t.settings.general}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1 flex items-center gap-1">
                <Globe className="w-3 h-3 text-blue-500" />
                <span>{t.settings.fieldLanguage}</span>
              </label>
              <select
                aria-label={t.settings.fieldLanguage}
                value={locale}
                onChange={(e) => setLocale(e.target.value as 'en' | 'zh')}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-medium"
              >
                <option value="zh">简体中文 (Simplified Chinese)</option>
                <option value="en">English (US)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                {t.settings.fieldCurrency}
              </label>
              <select
                aria-label={t.settings.fieldCurrency}
                value={formState.defaultCurrency}
                onChange={(e) =>
                  setFormState({ ...formState, defaultCurrency: e.target.value as CurrencyCode })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
              >
                <option value="USD">USD ($) — US Dollar</option>
                <option value="GBP">GBP (£) — British Pound</option>
                <option value="EUR">EUR (€) — Euro</option>
                <option value="CNY">CNY (¥) — Chinese Yuan / 人民币</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                {t.settings.fieldTheme}
              </label>
              <select
                aria-label={t.settings.fieldTheme}
                value={formState.theme}
                onChange={(e) =>
                  setFormState({ ...formState, theme: e.target.value as 'dark' | 'light' })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <option value="dark">
                  {locale === 'zh'
                    ? '机构深色主题 (默认推荐)'
                    : 'Institutional Dark Theme (Default)'}
                </option>
                <option value="light">
                  {locale === 'zh' ? '高对比日间浅色主题' : 'High-Contrast Daylight Theme'}
                </option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                {t.settings.fieldTimezone}
              </label>
              <select
                aria-label={t.settings.fieldTimezone}
                value={formState.timezone}
                onChange={(e) => setFormState({ ...formState, timezone: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
              >
                <option value="UTC (Coordinated Universal Time)">
                  {locale === 'zh' ? 'UTC (协调世界时)' : 'UTC (Coordinated Universal Time)'}
                </option>
                <option value="America/New_York (EST/EDT)">
                  {locale === 'zh' ? 'America/New_York (纽交所 / 美东)' : 'America/New_York (NYSE)'}
                </option>
                <option value="Europe/London (GMT/BST)">
                  {locale === 'zh' ? 'Europe/London (伦交所 / 伦敦)' : 'Europe/London (LSE)'}
                </option>
                <option value="Europe/Berlin (CET/CEST)">
                  {locale === 'zh' ? 'Europe/Berlin (德交所 / 法兰克福)' : 'Europe/Berlin (XETRA)'}
                </option>
                <option value="Asia/Shanghai (CST)">
                  {locale === 'zh'
                    ? 'Asia/Shanghai (上交所 / 深交所 / 港交所)'
                    : 'Asia/Shanghai (SSE / SZSE / HKEX)'}
                </option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] text-slate-500 mb-1">
                {t.settings.fieldSyncFreq}
              </label>
              <select
                aria-label={t.settings.fieldSyncFreq}
                value={formState.syncFrequency}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    syncFrequency: e.target.value as typeof formState.syncFrequency,
                  })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
              >
                <option value="15m">{locale === 'zh' ? '每 15 分钟' : 'Every 15 Minutes'}</option>
                <option value="1h">{locale === 'zh' ? '每 1 小时' : 'Every 1 Hour'}</option>
                <option value="6h">
                  {locale === 'zh' ? '每 6 小时 (推荐)' : 'Every 6 Hours (Recommended)'}
                </option>
                <option value="24h">
                  {locale === 'zh' ? '每日快照 (24小时)' : 'Daily Snapshot (24h)'}
                </option>
                <option value="Manual Only">
                  {locale === 'zh' ? '仅手动触发' : 'Manual Trigger Only'}
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* 2. API Settings, Beancount & External Connectors (6 cols) */}
        <div className="lg:col-span-6 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Server className="w-4 h-4 text-blue-500" />
              <span>{t.settings.endpoints}</span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {t.settings.backendWarningDesc}
            </p>
          </div>

          <div className="p-2.5 rounded bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 font-mono flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{t.settings.backendWarningTitle}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-sans text-slate-500">
                  {t.settings.fieldBackendUrl}
                </label>
                <span className="text-[9px] text-slate-400 font-sans">
                  {locale === 'zh' ? '仅浏览器端' : 'Browser Only'}
                </span>
              </div>
              <input
                type="text"
                aria-label="Local Backend URL"
                value={formState.localBackendUrl}
                onChange={(e) => setFormState({ ...formState, localBackendUrl: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]"
              />
              <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                {locale === 'zh' ? '默认: http://127.0.0.1:8000' : 'Default: http://127.0.0.1:8000'}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-sans text-slate-500">
                  {t.settings.fieldFavaUrl}
                </label>
                <span className="text-[9px] text-slate-400 font-sans">
                  {locale === 'zh' ? '仅浏览器端' : 'Browser Only'}
                </span>
              </div>
              <input
                type="text"
                aria-label="Fava Server URL"
                value={formState.favaUrl}
                onChange={(e) => setFormState({ ...formState, favaUrl: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]"
              />
              <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                {locale === 'zh' ? '默认: http://127.0.0.1:5000' : 'Default: http://127.0.0.1:5000'}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-sans text-slate-500">
                  {t.settings.fieldBeancountPath}
                </label>
                <span className="text-[9px] text-slate-400 font-sans">
                  {locale === 'zh' ? '仅展示' : 'Display Only'}
                </span>
              </div>
              <input
                type="text"
                aria-label="Beancount File Path"
                value={formState.beancountFilePath}
                onChange={(e) => setFormState({ ...formState, beancountFilePath: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]"
              />
              <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                {locale === 'zh'
                  ? '启动 Fava 时配置本地绝对路径'
                  : 'Actual file path is set when starting Fava'}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-sans text-slate-500">
                  {t.settings.fieldDailyApiUrl}
                </label>
                <span className="text-[9px] text-slate-400 font-sans">
                  {locale === 'zh' ? '外部服务端口' : 'External Service'}
                </span>
              </div>
              <input
                type="text"
                aria-label="Daily Analysis Connector URL"
                value={formState.dailyAnalysisApiUrl}
                onChange={(e) =>
                  setFormState({ ...formState, dailyAnalysisApiUrl: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]"
              />
              <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                {locale === 'zh' ? '独立投研分析服务端口' : 'External independent service port'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. AI Model Providers, Agent Budgets & Automation Governance (6 cols) */}
        <div className="lg:col-span-6 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-blue-500" />
              <span>{t.settings.budgets}</span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {locale === 'zh'
                ? '客户端前端预算限制。在实装模式下，后端将在调用云端 Gemini 前严格校验硬性支出限额。'
                : 'Client-side budget limits. In Phase 2, hard spending caps are verified on the FastAPI backend before executing Gemini tasks.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                {t.settings.fieldBudgetCap}
              </label>
              <input
                type="number"
                aria-label="Global Daily Assistant Budget Cap"
                value={formState.assistantDailyBudgetUSD}
                onChange={(e) =>
                  setFormState({ ...formState, assistantDailyBudgetUSD: Number(e.target.value) })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                {t.settings.fieldMaxSteps}
              </label>
              <input
                type="number"
                aria-label="Max Steps per Run"
                value={formState.assistantMaxStepsPerRun}
                onChange={(e) =>
                  setFormState({ ...formState, assistantMaxStepsPerRun: Number(e.target.value) })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
              />
            </div>
          </div>

          <div className="space-y-2 pt-1 font-mono text-[11px]">
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span>
                {locale === 'zh'
                  ? '严格人机协同门禁 (置信度 < 0.85)'
                  : 'Strict Human-in-the-Loop Gate (Confidence < 0.85)'}
              </span>
              <span className="text-emerald-500 font-bold">
                {locale === 'zh' ? '强制生效 (ENFORCED)' : 'ENFORCED'}
              </span>
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span>
                {locale === 'zh'
                  ? '银行与券商只读连接器隔离模式'
                  : 'Read-Only Bank & Brokerage Connector Mode'}
              </span>
              <span className="text-emerald-500 font-bold">
                {locale === 'zh' ? '只读锁定 (LOCKED READ-ONLY)' : 'LOCKED READ-ONLY'}
              </span>
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span>
                {locale === 'zh'
                  ? '前端浏览器客户端 API 密钥存储'
                  : 'Client-Side API Keys / Secrets Storage'}
              </span>
              <span className="text-emerald-500 font-bold">
                {locale === 'zh'
                  ? '严禁存储 (浏览器端 0 密钥)'
                  : 'PROHIBITED (0 KEYS IN BROWSER)'}
              </span>
            </div>
          </div>
        </div>

        {/* 4. Data Storage, DuckDB/PostgreSQL & Backup Recovery (6 cols) */}
        <div className="lg:col-span-6 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center gap-1.5">
            <HardDrive className="w-4 h-4 text-blue-500" />
            <span>{t.settings.storage}</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                {t.settings.fieldRetentionDays}
              </label>
              <input
                type="number"
                aria-label="Data Retention Days"
                value={formState.dataRetentionDays}
                onChange={(e) =>
                  setFormState({ ...formState, dataRetentionDays: Number(e.target.value) })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                {locale === 'zh' ? '当前运行时存储适配器' : 'Current Runtime Storage Adapter'}
              </label>
              <input
                type="text"
                readOnly
                value={
                  locale === 'zh'
                    ? '模拟适配器 + LocalStorage (演示模式)'
                    : 'Mock Adapter + LocalStorage (DEMO)'
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 font-mono text-slate-500"
              />
            </div>
          </div>

          <div className="p-3 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
            <div>
              {locale === 'zh'
                ? '• 主交易流水与审计数据库 (目标架构): PostgreSQL 16 (本地宿主机)'
                : '• Main Transactional & Audit DB (Target): PostgreSQL 16 (Local Machine)'}
            </div>
            <div>
              {locale === 'zh'
                ? '• 分析与量化投研存储 (目标架构): DuckDB + Apache Parquet'
                : '• Analytical & Quant Research Store (Target): DuckDB + Apache Parquet'}
            </div>
            <div>
              {locale === 'zh'
                ? '• 权威会计底稿账本 (目标架构): Beancount 纯文本 Git 版本库'
                : '• Authoritative Accounting Ledger (Target): Beancount Plain-Text Git Repo'}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() =>
                showToast(
                  locale === 'zh'
                    ? '已模拟导出加密状态快照: ofinance-demo-snapshot-20261102.json'
                    : 'Simulated encrypted snapshot exported: ofinance-demo-snapshot-20261102.json',
                  'success'
                )
              }
              className="px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-mono text-[11px] transition-colors"
            >
              {locale === 'zh' ? '导出演示快照 (JSON)' : 'Export Demo Snapshot (JSON)'}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-xs transition-colors"
            >
              {locale === 'zh' ? '保存所有偏好' : 'Save All Settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
