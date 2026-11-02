import React, { useState } from 'react';
import { useOFinance } from '../../app/providers/OFinanceContext';
import { formatCurrency, formatPercent } from '../../utils/finance';
import { ResearchReportItem } from '../../types';
import { Globe, FileText, Calendar, Link2, Eye, X, ShieldCheck } from 'lucide-react';

const INDICES_SNAPSHOT = [
  { name: 'S&P 500 (SPX)', value: '5,892.45', changePct: +0.68, region: 'US' },
  { name: 'NASDAQ-100 (NDX)', value: '20,640.10', changePct: +1.14, region: 'US' },
  { name: 'FTSE 100 (UKX)', value: '8,284.20', changePct: -0.18, region: 'UK' },
  { name: 'DAX 40 (GDAXI)', value: '19,412.80', changePct: +0.52, region: 'EU' },
  { name: 'US 10Y Treasury Yield', value: '4.24%', changePct: -0.03, region: 'Rates' },
  { name: 'Gold Spot (XAU/USD)', value: '$2,748.50', changePct: +0.41, region: 'Commodities' },
];

export const MarketIntelligencePage: React.FC = () => {
  const {
    watchlist,
    researchReports,
    economicCalendar,
    settings,
    showToast,
  } = useOFinance();

  const [selectedReport, setSelectedReport] = useState<ResearchReportItem | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const filteredReports = researchReports.filter(
    (r) => categoryFilter === 'ALL' || r.category === categoryFilter
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
            Market Intelligence & External Research Hub (DEMO)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Simulated global benchmarks, watchlist valuation metrics, macro economic calendar, and read-only External Research Connectors.
          </p>
        </div>
        <span className="text-xs font-mono text-amber-600 dark:text-amber-400">
          SIMULATED MARKET DATA · NO LIVE EXCHANGE FEED
        </span>
      </div>

      {/* 1. Market Overview Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 font-mono">
        {INDICES_SNAPSHOT.map((idx) => (
          <div
            key={idx.name}
            className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800"
          >
            <div className="text-[11px] text-slate-500 truncate">{idx.name}</div>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {idx.value}
            </div>
            <div
              className={`text-[11px] mt-0.5 tabular-nums ${
                idx.changePct >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatPercent(idx.changePct)} · {idx.region}
            </div>
          </div>
        ))}
      </div>

      {/* 10.1 External Research Connector: Daily Analysis Connector */}
      <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-blue-500" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                External Research Connector · Daily Analysis Connector (daily_stock_analysis)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Strict Architectural Boundary: Independent external project. Zero code/database merge. Read-only API placeholder only.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-mono font-semibold">
              Connection Status: Not Connected
            </span>
            <button
              type="button"
              onClick={() =>
                showToast(
                  'Daily Analysis Connector is a read-only placeholder in Demo Mode. No external HTTP request dispatched.',
                  'info'
                )
              }
              className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-mono"
            >
              Test Read-Only Ping (Placeholder)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs font-mono bg-slate-50 dark:bg-slate-900/70 p-3 rounded border border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-[10px] text-slate-400 block">Service Name</span>
            <span className="font-semibold text-slate-900 dark:text-white">Daily Analysis Connector</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">API Base URL (Placeholder)</span>
            <span className="text-blue-600 dark:text-blue-400">{settings.dailyAnalysisApiUrl}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Last Report Sync</span>
            <span>Never (Placeholder Interface)</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Latest Report Date</span>
            <span>N/A (Not Connected)</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Sync History</span>
            <span>0 External Calls Made</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>
            Boundary Contract Verified: O-Finance does not bundle daily_stock_analysis code, does not duplicate its database, and does not re-implement its internal logic.
          </span>
        </div>
      </div>

      {/* Main Grid: Watchlist (6 cols) + Research Reports & News (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 2. Watchlist Table */}
        <div className="lg:col-span-6 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-blue-500" />
              <span>Core Equity & ETF Watchlist (Simulated)</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-400">{watchlist.length} Symbols</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                  <th className="py-2 pr-2 font-medium">Symbol</th>
                  <th className="py-2 px-2 font-medium">Security</th>
                  <th className="py-2 px-2 font-medium text-right">Price</th>
                  <th className="py-2 px-2 font-medium text-right">Chg %</th>
                  <th className="py-2 px-2 font-medium text-right">P/E</th>
                  <th className="py-2 pl-2 font-medium text-right">Yield</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-mono">
                {watchlist.map((w) => (
                  <tr key={w.symbol} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 pr-2 font-bold text-blue-600 dark:text-blue-400">
                      {w.symbol}
                    </td>
                    <td className="py-2.5 px-2 font-sans text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                      {w.name}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums">
                      {formatCurrency(w.price, w.currency)}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right tabular-nums ${
                        w.changePct >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatPercent(w.changePct)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-500 tabular-nums">
                      {w.peRatio.toFixed(1)}x
                    </td>
                    <td className="py-2.5 pl-2 text-right text-slate-500 tabular-nums">
                      {w.dividendYieldPct.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Research Reports */}
        <div className="lg:col-span-6 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-500" />
              <span>Research Briefings & Synthesis Notes (DEMO)</span>
            </h2>
            <div className="flex items-center gap-1 text-[11px] font-mono">
              {['ALL', 'Sector', 'Macro', 'Earnings', 'Quant Note'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2 py-0.5 rounded ${
                    categoryFilter === cat
                      ? 'bg-slate-900 text-white dark:bg-blue-600'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredReports.map((rep) => (
              <div
                key={rep.id}
                onClick={() => setSelectedReport(rep)}
                className="p-3 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-blue-500/40 cursor-pointer space-y-1.5 transition-colors"
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>
                    {rep.date} · {rep.category} · {rep.symbols.join(', ')}
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    <span>Read</span>
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  {rep.title}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                  {rep.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4 & 5. Economic Calendar & Market Events */}
      <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-blue-500" />
            <span>Global Macro & Central Bank Economic Calendar (Simulated Schedule)</span>
          </h2>
          <span className="text-xs font-mono text-slate-500">G3 Jurisdictions (US / UK / EU)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                <th className="py-2 pr-3 font-medium">Date & Time (UTC)</th>
                <th className="py-2 px-3 font-medium">Region</th>
                <th className="py-2 px-3 font-medium">Macro Event / Release</th>
                <th className="py-2 px-3 font-medium">Impact</th>
                <th className="py-2 px-3 font-medium text-right">Previous</th>
                <th className="py-2 px-3 font-medium text-right">Consensus</th>
                <th className="py-2 pl-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-mono text-[11px]">
              {economicCalendar.map((ev) => (
                <tr key={ev.id}>
                  <td className="py-2.5 pr-3 text-slate-500 whitespace-nowrap">
                    {ev.date} · {ev.timeUTC}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                    {ev.region}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-slate-900 dark:text-slate-100 font-medium">
                    {ev.event}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={
                        ev.impact === 'High'
                          ? 'text-amber-600 dark:text-amber-400 font-semibold'
                          : 'text-slate-500'
                      }
                    >
                      {ev.impact}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{ev.previous}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{ev.consensus}</td>
                  <td className="py-2.5 pl-3 text-right text-slate-400">{ev.simulatedActual}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Research Report Modal */}
      {selectedReport && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Research Briefing Reader"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-700 rounded max-w-xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <div className="text-[11px] font-mono text-blue-500">
                  {selectedReport.id} · {selectedReport.date} · {selectedReport.category}
                </div>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white mt-0.5">
                  {selectedReport.title}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close research briefing"
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-3">
              <div className="font-mono text-[11px] text-slate-500">
                Source: {selectedReport.source} · Symbols: {selectedReport.symbols.join(', ')} · Posture: {selectedReport.sentiment}
              </div>
              <p>{selectedReport.summary}</p>
              <div className="p-3 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-500">
                NOTE: This briefing is a simulated research artifact generated for O-Finance DEMO Mode. It does not constitute investment advice.
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="px-4 py-1.5 rounded bg-blue-600 text-white text-xs font-medium"
              >
                Close Briefing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
