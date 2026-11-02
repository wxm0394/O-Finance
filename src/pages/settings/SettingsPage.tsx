import React, { useState } from 'react';
import { useOFinance } from '../../app/providers/OFinanceContext';
import { CurrencyCode } from '../../types';
import { Save, RotateCcw, HardDrive, Shield, Server } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, showToast } = useOFinance();

  const [formState, setFormState] = useState(settings);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formState);
  };

  const handleResetDemo = () => {
    localStorage.removeItem('ofinance_demo_settings_v1');
    showToast('Local Demo Settings reset to default workstation profile.', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
            System Settings & Local Architecture Configuration (DEMO)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure display currency, theme, local FastAPI/Fava endpoints, AI Agent execution budgets, and data retention policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDemo}
            className="px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Local Demo Settings</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
        {/* 1. General, Appearance & Currency Settings (6 cols) */}
        <div className="lg:col-span-6 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
            1. General, Appearance & Currency Settings
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Default Base Currency</label>
              <select
                aria-label="Default Base Currency"
                value={formState.defaultCurrency}
                onChange={(e) =>
                  setFormState({ ...formState, defaultCurrency: e.target.value as CurrencyCode })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
              >
                <option value="USD">USD ($) — US Dollar</option>
                <option value="GBP">GBP (£) — British Pound</option>
                <option value="EUR">EUR (€) — Euro</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Workstation Theme</label>
              <select
                aria-label="Workstation Theme"
                value={formState.theme}
                onChange={(e) =>
                  setFormState({ ...formState, theme: e.target.value as 'dark' | 'light' })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <option value="dark">Institutional Dark Theme (Default)</option>
                <option value="light">High-Contrast Daylight Theme</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Workstation Timezone</label>
              <select
                aria-label="Workstation Timezone"
                value={formState.timezone}
                onChange={(e) => setFormState({ ...formState, timezone: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
              >
                <option value="UTC (Coordinated Universal Time)">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York (EST/EDT)">America/New_York (NYSE)</option>
                <option value="Europe/London (GMT/BST)">Europe/London (LSE)</option>
                <option value="Europe/Berlin (CET/CEST)">Europe/Berlin (XETRA)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Scheduled Sync Frequency</label>
              <select
                aria-label="Scheduled Sync Frequency"
                value={formState.syncFrequency}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    syncFrequency: e.target.value as typeof formState.syncFrequency,
                  })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
              >
                <option value="15m">Every 15 Minutes</option>
                <option value="1h">Every 1 Hour</option>
                <option value="6h">Every 6 Hours (Recommended)</option>
                <option value="24h">Daily Snapshot (24h)</option>
                <option value="Manual Only">Manual Trigger Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* 2. API Settings, Beancount & External Connectors (6 cols) */}
        <div className="lg:col-span-6 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center gap-1.5">
            <Server className="w-4 h-4 text-blue-500" />
            <span>2. Local Backend, Beancount Ledger & Connector Endpoints</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
            <div>
              <label className="block text-[11px] font-sans text-slate-500 mb-1">
                Python FastAPI Backend URL (VITE_API_BASE_URL)
              </label>
              <input
                type="text"
                aria-label="Local Backend URL"
                value={formState.localBackendUrl}
                onChange={(e) => setFormState({ ...formState, localBackendUrl: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-sans text-slate-500 mb-1">
                Fava Accounting Web Server URL
              </label>
              <input
                type="text"
                aria-label="Fava Server URL"
                value={formState.favaUrl}
                onChange={(e) => setFormState({ ...formState, favaUrl: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-sans text-slate-500 mb-1">
                Authoritative Beancount Ledger Path
              </label>
              <input
                type="text"
                aria-label="Beancount File Path"
                value={formState.beancountFilePath}
                onChange={(e) => setFormState({ ...formState, beancountFilePath: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-sans text-slate-500 mb-1">
                Daily Analysis Connector Read-Only URL
              </label>
              <input
                type="text"
                aria-label="Daily Analysis Connector URL"
                value={formState.dailyAnalysisApiUrl}
                onChange={(e) => setFormState({ ...formState, dailyAnalysisApiUrl: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>
          </div>
        </div>

        {/* 3. AI Model Providers, Agent Budgets & Automation Governance (6 cols) */}
        <div className="lg:col-span-6 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-blue-500" />
            <span>3. AI Model Providers, Agent Budgets & Automation Limits</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                Global Daily Agent Budget Cap (USD)
              </label>
              <input
                type="number"
                aria-label="Global Daily Agent Budget Cap"
                value={formState.agentDailyBudgetUSD}
                onChange={(e) =>
                  setFormState({ ...formState, agentDailyBudgetUSD: Number(e.target.value) })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                Max Reasoning Steps per Orchestrator Run
              </label>
              <input
                type="number"
                aria-label="Max Steps per Run"
                value={formState.agentMaxStepsPerRun}
                onChange={(e) =>
                  setFormState({ ...formState, agentMaxStepsPerRun: Number(e.target.value) })
                }
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
              />
            </div>
          </div>

          <div className="space-y-2 pt-1 font-mono text-[11px]">
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span>Strict Human-in-the-Loop Gate (Confidence &lt; 0.85)</span>
              <span className="text-emerald-500 font-bold">ENFORCED</span>
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span>Read-Only Bank & Brokerage Connector Mode</span>
              <span className="text-emerald-500 font-bold">LOCKED READ-ONLY</span>
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span>Client-Side API Keys / Secrets Storage</span>
              <span className="text-emerald-500 font-bold">PROHIBITED (0 KEYS IN BROWSER)</span>
            </div>
          </div>
        </div>

        {/* 4. Data Storage, DuckDB/PostgreSQL & Backup Recovery (6 cols) */}
        <div className="lg:col-span-6 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center gap-1.5">
            <HardDrive className="w-4 h-4 text-blue-500" />
            <span>4. Data Storage, Analytics Engine & Backup Recovery</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                Audit & Ledger Retention Policy (Days)
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
                Current Runtime Storage Adapter
              </label>
              <input
                type="text"
                readOnly
                value="Mock Adapter + LocalStorage (DEMO)"
                className="w-full px-2.5 py-1.5 rounded bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 font-mono text-slate-500"
              />
            </div>
          </div>

          <div className="p-3 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
            <div>• Main Transactional & Audit DB (Target): PostgreSQL 16 (Local Kali Linux)</div>
            <div>• Analytical & Quant Research Store (Target): DuckDB + Apache Parquet</div>
            <div>• Authoritative Accounting Ledger (Target): Beancount Plain-Text Git Repo</div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() =>
                showToast(
                  'Simulated encrypted snapshot exported: ofinance-demo-snapshot-20261102.json',
                  'success'
                )
              }
              className="px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-mono text-[11px]"
            >
              Export Demo Snapshot (JSON)
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs"
            >
              Save All Settings
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
