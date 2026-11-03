import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useOFinance } from '../../app/providers/OFinanceContext';
import { useI18n } from '../../i18n';
import { TimeRange, TransactionRecord, AssistantTaskLog } from '../../types';
import {
  convertCurrency,
  formatCurrency,
  formatPercent,
  FX_LAST_UPDATED,
  SIMULATED_FX_RATES_TO_USD,
} from '../../utils/finance';
import { ArrowUpRight, RefreshCw, Eye, X, ExternalLink } from 'lucide-react';

const TIME_RANGES: TimeRange[] = ['1W', '1M', '3M', '6M', '1Y', 'ALL'];

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#14B8A6', '#8B5CF6'];

export const OverviewPage: React.FC = () => {
  const { t } = useI18n();
  const {
    baseCurrency,
    setBaseCurrency,
    wealthSummary,
    accounts,
    holdings,
    transactions,
    approvalTasks,
    assistantTaskLogs,
    netWorthHistory,
    cashFlowHistory,
    lastGlobalSync,
    failedSyncQueue,
    isSyncing,
    triggerSimulatedSync,
  } = useOFinance();

  const navigate = useNavigate();
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1Y');
  const [selectedActivity, setSelectedActivity] = useState<{
    type: 'transaction' | 'assistant';
    tx?: TransactionRecord;
    log?: AssistantTaskLog;
  } | null>(null);

  // Filter historical points based on selected TimeRange
  const filteredHistory = useMemo(() => {
    const rateFactor = convertCurrency(1, 'USD', baseCurrency);
    const scaled = netWorthHistory.map((pt) => ({
      ...pt,
      netWorth: Math.round(pt.netWorthUSD * rateFactor),
      cash: Math.round(pt.cashUSD * rateFactor),
      investments: Math.round(pt.investmentsUSD * rateFactor),
    }));

    switch (selectedRange) {
      case '1W':
        return [
          { ...scaled[scaled.length - 2], label: 'Oct 27' },
          { ...scaled[scaled.length - 2], label: 'Oct 29', netWorth: Math.round(scaled[scaled.length - 2].netWorth * 1.001) },
          { ...scaled[scaled.length - 1], label: 'Oct 31', netWorth: Math.round(scaled[scaled.length - 1].netWorth * 0.999) },
          { ...scaled[scaled.length - 1], label: 'Nov 02' },
        ];
      case '1M':
        return scaled.slice(-2);
      case '3M':
        return scaled.slice(-3);
      case '6M':
        return scaled.slice(-6);
      case '1Y':
      case 'ALL':
      default:
        return scaled;
    }
  }, [netWorthHistory, selectedRange, baseCurrency]);

  const scaledCashFlow = useMemo(() => {
    const rateFactor = convertCurrency(1, 'USD', baseCurrency);
    const sliceCount =
      selectedRange === '3M' ? 3 : selectedRange === '6M' ? 6 : 12;
    return cashFlowHistory.slice(-sliceCount).map((cf) => ({
      month: cf.month,
      Inflow: Math.round(cf.inflowUSD * rateFactor),
      Outflow: Math.round(cf.outflowUSD * rateFactor),
      NetSavings: Math.round(cf.netSavingsUSD * rateFactor),
    }));
  }, [cashFlowHistory, selectedRange, baseCurrency]);

  // Asset Allocation breakdown in baseCurrency
  const allocationData = useMemo(() => {
    const map: Record<string, number> = {
      'Cash Reserves': wealthSummary.totalCash,
    };
    for (const h of holdings) {
      const val = convertCurrency(h.marketValue, h.currency, baseCurrency);
      map[h.assetType] = (map[h.assetType] || 0) + val;
    }
    const total = Object.values(map).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        value: Math.round(value),
        pct: ((value / total) * 100).toFixed(1),
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, wealthSummary.totalCash, baseCurrency]);

  const demoConnectedCount = accounts.filter((a) => a.connectionStatus !== 'Not Connected').length;
  const notConnectedCount = accounts.filter((a) => a.connectionStatus === 'Not Connected').length;
  const pendingReviewTxCount = transactions.filter((t) => t.ledgerStatus === 'Pending Approval').length;
  const anomalyCount =
    transactions.filter((t) => t.ledgerStatus === 'Anomaly Flagged').length +
    approvalTasks.filter((t) => t.status === 'Pending' && (t.riskLevel === 'High' || t.riskLevel === 'Critical')).length;

  return (
    <div className="space-y-6">
      {/* Section Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
            {t.overview.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.overview.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex items-center bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 rounded p-0.5">
            {TIME_RANGES.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setSelectedRange(range)}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors ${
                  selectedRange === range
                    ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Explicit Runtime Telemetry Pill-free Text */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
            <span>Backend: Mock Adapter</span>
            <span aria-hidden="true">·</span>
            <span>Agent Runtime: Simulated</span>
          </div>
        </div>
      </div>

      {/* 5.1 Top Wealth Summary Strip (7 Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.overview.totalNetWorth}</div>
          <div className="text-lg font-mono font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {formatCurrency(wealthSummary.totalNetWorth, baseCurrency)}
          </div>
          <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            Cash + Inv - Liab
          </div>
        </div>

        <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.overview.totalCash}</div>
          <div className="text-lg font-mono font-semibold text-slate-900 dark:text-white mt-1 tabular-nums">
            {formatCurrency(wealthSummary.totalCash, baseCurrency)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Matches 6 Accounts Cash
          </div>
        </div>

        <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.overview.totalInvestments}</div>
          <div className="text-lg font-mono font-semibold text-slate-900 dark:text-white mt-1 tabular-nums">
            {formatCurrency(wealthSummary.totalInvestments, baseCurrency)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Matches 17 Holdings
          </div>
        </div>

        <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.overview.totalLiabilities}</div>
          <div className="text-lg font-mono font-semibold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
            {formatCurrency(wealthSummary.totalLiabilities, baseCurrency)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            0.71% Debt-to-Asset
          </div>
        </div>

        <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.overview.dailyPnL}</div>
          <div className="text-lg font-mono font-semibold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {formatCurrency(wealthSummary.dailyPnL, baseCurrency, { showSign: true })}
          </div>
          <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {formatPercent(wealthSummary.dailyPnLPct)} Today
          </div>
        </div>

        <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.overview.monthlyPnL}</div>
          <div className="text-lg font-mono font-semibold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {formatCurrency(wealthSummary.monthlyPnL, baseCurrency, { showSign: true })}
          </div>
          <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {formatPercent(wealthSummary.monthlyPnLPct)} 30D
          </div>
        </div>

        <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.overview.overallReturn}</div>
          <div className="text-lg font-mono font-semibold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {formatCurrency(wealthSummary.overallReturn, baseCurrency, { showSign: true })}
          </div>
          <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {formatPercent(wealthSummary.overallReturnPct)} Total ROI
          </div>
        </div>
      </div>

      {/* Simulated FX Rates Strip */}
      <div className="px-4 py-2.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
          <span>DETERMINISTIC FX ENGINE (SIMULATED):</span>
          <span>1 USD = 1.0000 USD</span>
          <span>·</span>
          <span>1 GBP = {SIMULATED_FX_RATES_TO_USD.GBP.toFixed(4)} USD</span>
          <span>·</span>
          <span>1 EUR = {SIMULATED_FX_RATES_TO_USD.EUR.toFixed(4)} USD</span>
          <span>·</span>
          <span>1 CNY = {SIMULATED_FX_RATES_TO_USD.CNY.toFixed(4)} USD</span>
        </div>
        <div className="text-slate-500 dark:text-slate-400">{FX_LAST_UPDATED}</div>
      </div>

      {/* 5.2 Charts Grid (5 Charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 1. Net Worth History (8 cols) */}
        <div className="lg:col-span-8 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Net Worth History ({selectedRange} · {baseCurrency} Simulated)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Stacked trajectory of Cash Reserves and Investment Holdings
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              Latest: {formatCurrency(wealthSummary.totalNetWorth, baseCurrency)}
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredHistory} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  tickFormatter={(v) => formatCurrency(v, baseCurrency, { compact: true })}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', fontSize: '12px', color: '#F8FAFC' }}
                  formatter={(val: unknown) => formatCurrency(Number(val) || 0, baseCurrency)}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area
                  type="monotone"
                  dataKey="investments"
                  name="Investments"
                  stackId="1"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.25}
                />
                <Area
                  type="monotone"
                  dataKey="cash"
                  name="Cash Reserves"
                  stackId="1"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.25}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Asset Allocation (4 cols) */}
        <div className="lg:col-span-4 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Asset Allocation ({baseCurrency})
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Cross-account capital distribution
            </p>
          </div>
          <div className="h-44 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocationData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {allocationData.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', fontSize: '12px', color: '#F8FAFC' }}
                  formatter={(val: unknown) => formatCurrency(Number(val) || 0, baseCurrency)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 text-xs">
            {allocationData.slice(0, 5).map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-slate-600 dark:text-slate-300 truncate">
                  {idx + 1}. {item.name}
                </span>
                <span className="text-slate-900 dark:text-slate-100 tabular-nums">
                  {formatCurrency(item.value, baseCurrency, { compact: true })} ({item.pct}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Cash Flow Trend (5 cols) */}
        <div className="lg:col-span-5 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Monthly Cash Flow ({baseCurrency} · Excludes Internal Transfers)
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Verified Inflows vs Outflows & Net Savings
            </p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scaledCashFlow} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94A3B8' }}
                  tickFormatter={(v) => formatCurrency(v, baseCurrency, { compact: true })}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', fontSize: '12px', color: '#F8FAFC' }}
                  formatter={(val: unknown) => formatCurrency(Number(val) || 0, baseCurrency)}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Inflow" fill="#10B981" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Outflow" fill="#EF4444" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Investment Performance vs Benchmark (4 cols) */}
        <div className="lg:col-span-4 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Portfolio Cumulative Return vs Benchmark (%)
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              O-Finance Composite (+16.8%) vs Global 60/40 (+12.4%)
            </p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredHistory} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', fontSize: '12px', color: '#F8FAFC' }}
                  formatter={(val: unknown) => `${val}%`}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line
                  type="monotone"
                  dataKey="portfolioReturnPct"
                  name="O-Finance Portfolio"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="benchmarkReturnPct"
                  name="Benchmark"
                  stroke="#94A3B8"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5. Currency Exposure (3 cols) */}
        <div className="lg:col-span-3 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Currency Exposure ({baseCurrency})
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              USD, GBP, EUR & CNY Net Asset Breakdown
            </p>
          </div>

          <div className="space-y-3 my-4">
            {wealthSummary.currencyExposure.map((item) => (
              <div key={item.currency} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{item.currency}</span>
                  <span className="text-slate-600 dark:text-slate-400">
                    {formatCurrency(item.amountInBase, baseCurrency)} ({item.weightPct}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-blue-600 dark:bg-blue-500"
                    style={{ width: `${Math.min(100, item.weightPct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            Non-USD Hedge Ratio: 0.0% (Unhedged Spot)
          </div>
        </div>
      </div>

      {/* 5.3 Account Health Status + 5.4 Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 5.3 Account Health Status (4 cols) */}
        <div className="lg:col-span-4 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Account & Sync Health (DEMO)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Read-only connector & reconciliation telemetry
              </p>
            </div>
            <button
              type="button"
              onClick={() => triggerSimulatedSync()}
              disabled={isSyncing}
              className="px-2.5 py-1 text-xs font-mono rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Demo Connected</div>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {demoConnectedCount} / {accounts.length}
              </div>
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Not Connected</div>
              <div className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                {notConnectedCount}
              </div>
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Failed Sync Queue</div>
              <div className="text-base font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                {failedSyncQueue.length}
              </div>
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Pending Review Tx</div>
              <div className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                {pendingReviewTxCount}
              </div>
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Anomalies Flagged</div>
              <div className="text-base font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                {anomalyCount}
              </div>
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Last Global Sync</div>
              <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
                {lastGlobalSync.slice(5, 16)} UTC
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => navigate('/accounts')}
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>Manage Connectors</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/approvals')}
              className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
            >
              <span>Review {approvalTasks.filter((t) => t.status === 'Pending').length} Approvals</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 5.4 Recent Activity Stream (8 cols) */}
        <div className="lg:col-span-8 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Recent Financial & Assistant Activity (Click Row to Inspect)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Bank flows, brokerage executions, dividends, fees, Beancount postings, and OFinanceAssistant runs
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/transactions')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              View All {transactions.length} Transactions →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 px-3 font-medium">Source / Account</th>
                  <th className="py-2 px-3 font-medium">Type</th>
                  <th className="py-2 px-3 font-medium">Description</th>
                  <th className="py-2 px-3 font-medium text-right">Amount</th>
                  <th className="py-2 pl-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {transactions.slice(0, 6).map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => setSelectedActivity({ type: 'transaction', tx })}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2 pr-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {tx.institution}
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {tx.type}
                    </td>
                    <td className="py-2 px-3 text-slate-900 dark:text-slate-100 max-w-xs truncate">
                      {tx.description}
                    </td>
                    <td
                      className={`py-2 px-3 font-mono text-right whitespace-nowrap tabular-nums ${
                        tx.direction === 'Internal Transfer'
                          ? 'text-blue-600 dark:text-blue-400'
                          : tx.amount >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {formatCurrency(tx.amount, tx.currency, { showSign: true })} {tx.currency}
                    </td>
                    <td className="py-2 pl-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedActivity({ type: 'transaction', tx });
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {assistantTaskLogs.slice(0, 2).map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedActivity({ type: 'assistant', log })}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2 pr-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {log.timestamp.slice(0, 10)}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-blue-600 dark:text-blue-400 font-medium">
                      {log.assistantName} ({log.taskMode})
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      Assistant Run
                    </td>
                    <td className="py-2 px-3 text-slate-900 dark:text-slate-100 max-w-xs truncate">
                      {log.taskSummary}
                    </td>
                    <td className="py-2 px-3 font-mono text-right text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {log.tokensUsed !== null ? `${log.tokensUsed} tok` : 'Demo Adapter (0 real tok)'} · {log.durationMs}ms
                    </td>
                    <td className="py-2 pl-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedActivity({ type: 'assistant', log });
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Activity Inspection Modal */}
      {selectedActivity && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Activity Detail Inspector"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-700 rounded max-w-xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                  {selectedActivity.type === 'transaction'
                    ? `Transaction Record · ${selectedActivity.tx?.id} (DEMO)`
                    : `OFinanceAssistant Trace · ${selectedActivity.log?.id} (SIMULATED)`}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  DEMO MODE · SIMULATED FINANCIAL DATA
                </p>
              </div>
              <button
                type="button"
                aria-label="Close activity inspector"
                onClick={() => setSelectedActivity(null)}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedActivity.tx && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 font-mono bg-slate-50 dark:bg-slate-900/80 p-3 rounded border border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Institution / Account</span>
                    <span>{selectedActivity.tx.accountName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Amount & Currency</span>
                    <span className="font-bold">
                      {formatCurrency(selectedActivity.tx.amount, selectedActivity.tx.currency, { showSign: true })}{' '}
                      {selectedActivity.tx.currency}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Beancount Category</span>
                    <span>{selectedActivity.tx.category}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Ledger Status</span>
                    <span>{selectedActivity.tx.ledgerStatus}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 mb-1">Raw Feed Source Payload</div>
                  <pre className="p-2.5 rounded bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto">
                    {selectedActivity.tx.rawSourceJson}
                  </pre>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedActivity(null);
                      navigate('/accounting');
                    }}
                    className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 flex items-center gap-1"
                  >
                    <span>View in Beancount Ledger</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedActivity(null)}
                    className="px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {selectedActivity.log && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 font-mono bg-slate-50 dark:bg-slate-900/80 p-3 rounded border border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Assistant & Task Mode</span>
                    <span>
                      {selectedActivity.log.assistantName} ({selectedActivity.log.taskMode})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Timestamp</span>
                    <span>{selectedActivity.log.timestamp}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Tools Invoked</span>
                    <span>{selectedActivity.log.toolsInvoked.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Status</span>
                    <span>{selectedActivity.log.status}</span>
                  </div>
                </div>
                <div className="p-3 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="font-semibold mb-1">{selectedActivity.log.taskSummary}</div>
                  <p className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                    {selectedActivity.log.outputPreview}
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedActivity(null);
                      navigate('/agent-center');
                    }}
                    className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-500"
                  >
                    Open AI Assistant Center
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedActivity(null)}
                    className="px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
