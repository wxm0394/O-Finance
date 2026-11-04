import React, { useState, useEffect } from 'react';
import { useOFinance } from '../../app/providers/OFinanceContext';
import { useI18n } from '../../i18n';
import { ConnectorConfig } from '../../types';
import { convertCurrency, formatCurrency } from '../../utils/finance';
import { RefreshCw, Link2, Unlink, ShieldAlert, CheckCircle2, X, Lock } from 'lucide-react';

export const AccountsPage: React.FC = () => {
  const { t, l } = useI18n();
  const {
    accounts,
    connectors,
    baseCurrency,
    settings,
    updateSettings,
    isSyncing,
    lastGlobalSync,
    syncHistory,
    failedSyncQueue,
    triggerSimulatedSync,
    retryFailedSync,
    toggleConnectorState,
  } = useOFinance();

  const [authModalConnector, setAuthModalConnector] = useState<ConnectorConfig | null>(null);
  const [regionFilter, setRegionFilter] = useState<string>('ALL');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAuthModalConnector(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const filteredAccounts = accounts.filter(
    (a) => regionFilter === 'ALL' || a.region === regionFilter
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
            {t.accounts.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.accounts.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 rounded p-0.5 text-xs font-mono">
            {['ALL', 'US', 'UK', 'EEA', 'Global'].map((reg) => (
              <button
                key={reg}
                type="button"
                onClick={() => setRegionFilter(reg)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  regionFilter === reg
                    ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {reg}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => triggerSimulatedSync()}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Simulating Sync...' : 'Sync All Accounts (Simulated)'}</span>
          </button>
        </div>
      </div>

      {/* Explicit Simulated Sync Notice */}
      <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-mono flex flex-wrap items-center justify-between gap-2">
        <span>
          Simulated Sync — No Real Financial Institution Connected. All balances and account identifiers below are fictional DEMO records.
        </span>
        <span>Read-Only Policy Enforced</span>
      </div>

      {/* 6.1 Accounts Table */}
      <div className="rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Active Financial Accounts ({filteredAccounts.length} DEMO Accounts)
          </h2>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Base Equivalent shown in {baseCurrency}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[960px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/60">
                <th className="py-2.5 pl-3 pr-2 font-medium">{t.accounts.institution}</th>
                <th className="py-2.5 px-2 font-medium">{t.accounts.accountName}</th>
                <th className="py-2.5 px-2 font-medium">{t.accounts.type}</th>
                <th className="py-2.5 px-1.5 font-medium">{t.accounts.currency}</th>
                <th className="py-2.5 px-2 font-medium text-right">{t.accounts.balance}</th>
                <th className="py-2.5 px-2 font-medium text-right">{t.accounts.availableCash}</th>
                <th className="py-2.5 px-2 font-medium text-right">{t.accounts.investmentValue}</th>
                <th className="py-2.5 px-2 font-medium">{t.accounts.lastSync}</th>
                <th className="py-2.5 px-2 font-medium">{t.accounts.status}</th>
                <th className="py-2.5 px-2 font-medium">{t.accounts.freshness}</th>
                <th className="sticky right-0 z-10 bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 py-2.5 px-3 font-medium text-right shadow-[-4px_0_6px_rgba(0,0,0,0.04)]">
                  {t.accounts.action}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredAccounts.map((acc) => {
                const netInBase = convertCurrency(
                  acc.availableCash + acc.investmentValue - acc.liabilityAmount,
                  acc.currency,
                  baseCurrency
                );
                return (
                  <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 pl-3 pr-2 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {l(acc.institution.replace(' (Simulated)', ''))}
                    </td>
                    <td className="py-2.5 px-2 text-slate-700 dark:text-slate-300 max-w-[185px]">
                      <div className="truncate font-medium" title={acc.accountName}>{l(acc.accountName)}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {acc.accountNumberMasked} · {acc.region}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {l(acc.accountType)}
                    </td>
                    <td className="py-2.5 px-1.5 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {acc.currency}
                    </td>
                    <td className="py-2.5 px-2 font-mono text-right tabular-nums whitespace-nowrap">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(acc.currentBalance, acc.currency)}
                      </div>
                      {acc.currency !== baseCurrency && (
                        <div className="text-[10px] text-slate-400">
                          ≈ {formatCurrency(netInBase, baseCurrency)}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2 font-mono text-right text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                      {formatCurrency(acc.availableCash, acc.currency)}
                    </td>
                    <td className="py-2.5 px-2 font-mono text-right text-blue-600 dark:text-blue-400 tabular-nums whitespace-nowrap">
                      {formatCurrency(acc.investmentValue, acc.currency)}
                    </td>
                    <td className="py-2.5 px-2 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {acc.lastSync.slice(5, 16)}
                    </td>
                    <td className="py-2.5 px-2 font-mono text-[11px] whitespace-nowrap">
                      <span
                        className={
                          isSyncing
                            ? 'text-blue-600 dark:text-blue-400 font-semibold'
                            : acc.connectionStatus === 'Connected (Simulated)'
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : acc.connectionStatus === 'Authorization Required' ||
                              acc.connectionStatus === 'Sync Failed'
                            ? 'text-rose-600 dark:text-rose-400 font-semibold'
                            : acc.connectionStatus === 'Stale Data' ||
                              acc.connectionStatus === 'Not Connected'
                            ? 'text-amber-600 dark:text-amber-400 font-semibold'
                            : 'text-slate-600 dark:text-slate-300'
                        }
                      >
                        {isSyncing ? t.nav.syncing : l(acc.connectionStatus)}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {l(acc.dataFreshness)}
                    </td>
                    <td className="sticky right-0 z-10 bg-white dark:bg-[#0F1420] border-l border-slate-100 dark:border-slate-800/80 py-2.5 px-3 text-right whitespace-nowrap shadow-[-4px_0_6px_rgba(0,0,0,0.04)]">
                      <button
                        type="button"
                        onClick={() => triggerSimulatedSync(acc.institution)}
                        className="px-2.5 py-1 text-[11px] font-mono rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
                      >
                        {t.accounts.syncNow}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6.2 Institution Connectors Grid */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Institution Connector Architecture (Default: Not Connected / Demo Only)
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Planned read-only API adapters for local FastAPI deployment. Never enter real bank passwords in Demo Mode.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Future roadmap: Crypto Exchanges, On-Chain Wallets, Physical Cash Vaults
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {connectors.map((conn) => {
            const isSimConnected = conn.connectionStatus === 'Simulated Connected';
            return (
              <div
                key={conn.id}
                className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {conn.institution}
                      </h3>
                      <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400">
                        {conn.plannedConnector}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 shrink-0">
                      {conn.connectionStatus}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 pt-1">
                    <div>
                      <strong className="text-slate-700 dark:text-slate-300">Supported Data:</strong>{' '}
                      {conn.supportedData.join(' · ')}
                    </div>
                    <div>
                      <strong className="text-slate-700 dark:text-slate-300">Auth Method:</strong>{' '}
                      {conn.authMethod}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      Scope: {conn.permissionsScope} · Freq: {conn.syncFrequency}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      Last Sync: {conn.lastSyncTime} · Config: {conn.configStatus}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  {!isSimConnected ? (
                    <button
                      type="button"
                      onClick={() => setAuthModalConnector(conn)}
                      className="flex-1 py-1.5 px-2.5 rounded bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium hover:opacity-90 flex items-center justify-center gap-1.5"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Authorize (Sim)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleConnectorState(conn.id)}
                      className="flex-1 py-1.5 px-2.5 rounded bg-rose-600/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-medium hover:bg-rose-600/20 flex items-center justify-center gap-1.5"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>Cycle State (Sim)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleConnectorState(conn.id)}
                    title="Cycle simulated connector state (Connected / Not Connected / Auth Required / Sync Failed / Stale)"
                    className="py-1.5 px-2.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-mono"
                  >
                    State
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerSimulatedSync(conn.institution)}
                    className="py-1.5 px-2.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-mono"
                  >
                    Sync Now
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6.3 Automatic Sync Management & Failed Sync Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Auto Sync Controls & Failed Queue (5 cols) */}
        <div className="lg:col-span-5 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Automatic Sync Scheduler (Simulated)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Simulated Sync — No Real Financial Institution Connected
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoSyncEnabled}
              aria-label="Toggle Automatic Sync"
              onClick={() => updateSettings({ autoSyncEnabled: !settings.autoSyncEnabled })}
              className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-colors ${
                settings.autoSyncEnabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {settings.autoSyncEnabled ? 'AUTO-SYNC: ON' : 'AUTO-SYNC: OFF'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block">Sync Frequency</span>
              <select
                aria-label="Sync Frequency Selector"
                value={settings.syncFrequency}
                onChange={(e) =>
                  updateSettings({ syncFrequency: e.target.value as typeof settings.syncFrequency })
                }
                className="mt-1 bg-transparent font-semibold text-slate-900 dark:text-white focus:outline-none w-full"
              >
                <option value="15m" className="bg-slate-900 text-white">Every 15m</option>
                <option value="1h" className="bg-slate-900 text-white">Every 1h</option>
                <option value="6h" className="bg-slate-900 text-white">Every 6h</option>
                <option value="24h" className="bg-slate-900 text-white">Every 24h</option>
                <option value="Manual Only" className="bg-slate-900 text-white">Manual Only</option>
              </select>
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block">Next Scheduled Sync</span>
              <span className="font-semibold text-slate-900 dark:text-white mt-1 block">
                2026-11-02 20:00 UTC
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Failed Sync Queue ({failedSyncQueue.length})
            </div>
            {failedSyncQueue.length === 0 ? (
              <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Zero failed sync jobs in queue.</span>
              </div>
            ) : (
              failedSyncQueue.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded bg-rose-500/10 border border-rose-500/30 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between font-semibold text-rose-700 dark:text-rose-300">
                    <span>{item.institution}</span>
                    <span className="font-mono text-[11px]">{item.timestamp.slice(11, 16)} UTC</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                    {item.error}
                  </p>
                  <button
                    type="button"
                    onClick={() => retryFailedSync(item.id)}
                    className="px-2.5 py-1 rounded bg-rose-600 text-white font-mono text-[11px] hover:bg-rose-500"
                  >
                    Retry Sync (Simulated)
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Sync History Log (7 cols) */}
        <div className="lg:col-span-7 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Sync Execution History (DEMO)
            </h2>
            <span className="text-xs font-mono text-slate-500"> Last Sync: {lastGlobalSync}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3 font-medium">Timestamp</th>
                  <th className="py-2 px-3 font-medium">Connector / Institution</th>
                  <th className="py-2 px-3 font-medium text-right">Records</th>
                  <th className="py-2 px-3 font-medium text-right">Duration</th>
                  <th className="py-2 pl-3 font-medium">Status & Verification Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-mono text-[11px]">
                {syncHistory.map((sh) => (
                  <tr key={sh.id}>
                    <td className="py-2.5 pr-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {sh.timestamp}
                    </td>
                    <td className="py-2.5 px-3 text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {sh.institution}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{sh.recordsProcessed}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{sh.durationMs}ms</td>
                    <td className="py-2.5 pl-3 text-slate-500 dark:text-slate-400">
                      <span
                        className={
                          sh.status === 'Simulated Success'
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : 'text-amber-600 dark:text-amber-400 font-semibold'
                        }
                      >
                        {sh.status}
                      </span>{' '}
                      · {sh.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Simulated Authorization Modal (No Passwords Collected) */}
      {authModalConnector && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Simulated Connector Authorization"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-700 rounded max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                  Simulated Read-Only Authorization · {authModalConnector.institution} (DEMO)
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close authorization modal"
                onClick={() => setAuthModalConnector(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-mono">
              DEMO SIMULATION ONLY — This dialog does NOT connect to {authModalConnector.institution} or collect any banking credentials. In production local deployment, OAuth / Flex tokens are stored exclusively in the local Python FastAPI vault.
            </div>

            <div className="space-y-2 text-xs font-mono bg-slate-50 dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-slate-400">Planned Adapter:</span> {authModalConnector.plannedConnector}
              </div>
              <div>
                <span className="text-slate-400">Permission Scope:</span> {authModalConnector.permissionsScope}
              </div>
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 pt-1">
                <Lock className="w-3.5 h-3.5" />
                <span>Zero Write / Trading / Transfer Permissions Requested</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAuthModalConnector(null)}
                className="px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleConnectorState(authModalConnector.id);
                  setAuthModalConnector(null);
                }}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
              >
                Simulate Read-Only Grant (DEMO)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
