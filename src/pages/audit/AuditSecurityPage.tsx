import React, { useState } from 'react';
import { useOFinance } from '../../app/providers/OFinanceContext';
import { useI18n } from '../../i18n';
import { ShieldCheck, Lock, FileSpreadsheet } from 'lucide-react';

const CATEGORIES = [
  'ALL',
  'Assistant Execution',
  'Account Sync',
  'API Access',
  'Approval Decision',
  'Ledger Change',
  'Auth Event',
  'Security Warning',
] as const;

export const AuditSecurityPage: React.FC = () => {
  const { auditLogs } = useOFinance();
  const { t, l } = useI18n();
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const filteredLogs = auditLogs.filter(
    (logItem) => categoryFilter === 'ALL' || logItem.category === categoryFilter
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
            {t.audit.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.audit.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-600 dark:text-emerald-400">
          <Lock className="w-3.5 h-3.5" />
          <span>{t.audit.verified} ({auditLogs.length} RECORDS)</span>
        </div>
      </div>

      {/* 10 Core Security Principles Panel */}
      <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>{t.audit.invariantsTitle}</span>
          </h2>
          <span className="text-xs font-mono text-slate-400">Enforced Across Desktop & FastAPI Layers</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
          {t.audit.invariants.map((p) => (
            <div
              key={p}
              className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px]"
            >
              {p}
            </div>
          ))}
        </div>
      </div>

      {/* Category Filter Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded transition-colors ${
                categoryFilter === cat
                  ? 'bg-slate-900 text-white dark:bg-blue-600'
                  : 'bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <span className="text-xs font-mono text-slate-500">
          Showing {filteredLogs.length} of {auditLogs.length} append-only records
        </span>
      </div>

      {/* Append-Only Audit Log Table */}
      <div className="rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-blue-500" />
            <span>Immutable System Audit Stream (Newest First)</span>
          </h2>
          <span className="text-[11px] font-mono text-slate-400">
            Interactive actions across the app append live entries here
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 bg-slate-50/50 dark:bg-slate-900/40">
                <th className="py-2.5 px-3 font-medium">{t.audit.colId}</th>
                <th className="py-2.5 px-3 font-medium">{t.audit.colTimestamp}</th>
                <th className="py-2.5 px-3 font-medium">{t.audit.colCategory}</th>
                <th className="py-2.5 px-3 font-medium">{t.audit.colActor}</th>
                <th className="py-2.5 px-3 font-medium">{t.audit.colAction}</th>
                <th className="py-2.5 px-3 font-medium">{t.audit.colSeverity}</th>
                <th className="py-2.5 px-3 font-medium">{t.audit.colHash}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-mono text-[11px]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    {log.id}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {log.category}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {log.actor}
                  </td>
                  <td className="py-2.5 px-3 font-sans max-w-md">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {log.action} → <span className="font-mono text-blue-500">{log.target}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{log.details}</div>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span
                      className={
                        log.severity === 'High'
                          ? 'text-rose-600 dark:text-rose-400 font-bold'
                          : log.severity === 'Warning'
                          ? 'text-amber-600 dark:text-amber-400 font-semibold'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }
                    >
                      {log.severity}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                    {log.verificationHash}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
