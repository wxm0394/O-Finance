import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useOFinance } from '../../app/providers/OFinanceContext';
import { AssetClass, PortfolioHolding } from '../../types';
import { convertCurrency, formatCurrency, formatPercent } from '../../utils/finance';
import { ArrowUpDown, Eye, X, PieChart, DollarSign, TrendingUp } from 'lucide-react';

const ASSET_CLASSES: AssetClass[] = [
  'US Equities',
  'International Equities',
  'ETFs',
  'Bonds',
  'REITs',
  'Crypto',
  'Other Assets',
];

const DIVIDEND_HISTORY_YTD = [
  { id: 'DIV-2026-14', exDate: '2026-10-25', payDate: '2026-10-29', symbol: 'SCHD', security: 'Schwab US Dividend Equity ETF', account: 'Charles Schwab', grossAmount: 362.64, withholdingTax: 0.0, netAmount: 362.64, currency: 'USD', ledgerAccount: 'Income:Dividends:Schwab:SCHD' },
  { id: 'DIV-2026-13', exDate: '2026-10-18', payDate: '2026-10-22', symbol: 'TSM', security: 'Taiwan Semiconductor ADR', account: 'Firstrade', grossAmount: 340.0, withholdingTax: 71.4, netAmount: 268.6, currency: 'USD', ledgerAccount: 'Income:Dividends:Firstrade:TSM' },
  { id: 'DIV-2026-12', exDate: '2026-10-01', payDate: '2026-10-15', symbol: 'O', security: 'Realty Income Corp REIT', account: 'Charles Schwab', grossAmount: 269.85, withholdingTax: 0.0, netAmount: 269.85, currency: 'USD', ledgerAccount: 'Income:Dividends:Schwab:O' },
  { id: 'DIV-2026-11', exDate: '2026-10-01', payDate: '2026-10-07', symbol: 'SGOV', security: 'iShares 0-3 Month Treasury Bond ETF', account: 'Charles Schwab', grossAmount: 132.0, withholdingTax: 0.0, netAmount: 132.0, currency: 'USD', ledgerAccount: 'Income:Interest:Treasury:SGOV' },
  { id: 'DIV-2026-10', exDate: '2026-09-28', payDate: '2026-10-02', symbol: 'VOO', security: 'Vanguard S&P 500 ETF', account: 'Charles Schwab', grossAmount: 245.0, withholdingTax: 0.0, netAmount: 245.0, currency: 'USD', ledgerAccount: 'Income:Dividends:Schwab:VOO' },
  { id: 'DIV-2026-09', exDate: '2026-09-15', payDate: '2026-09-24', symbol: 'TLT', security: 'iShares 20+ Year Treasury Bond ETF', account: 'Interactive Brokers', grossAmount: 295.0, withholdingTax: 0.0, netAmount: 295.0, currency: 'USD', ledgerAccount: 'Income:Dividends:IBKR:TLT' },
  { id: 'DIV-2026-08', exDate: '2026-08-21', payDate: '2026-09-12', symbol: 'MSFT', security: 'Microsoft Corp.', account: 'Interactive Brokers', grossAmount: 420.0, withholdingTax: 0.0, netAmount: 420.0, currency: 'USD', ledgerAccount: 'Income:Dividends:IBKR:MSFT' },
  { id: 'DIV-2026-07', exDate: '2026-08-10', payDate: '2026-08-16', symbol: 'AAPL', security: 'Apple Inc.', account: 'Interactive Brokers', grossAmount: 190.0, withholdingTax: 0.0, netAmount: 190.0, currency: 'USD', ledgerAccount: 'Income:Dividends:IBKR:AAPL' },
  { id: 'DIV-2026-06', exDate: '2026-05-16', payDate: '2026-05-21', symbol: 'SAP.DE', security: 'SAP SE (XETRA)', account: 'European Bank Depot', grossAmount: 220.0, withholdingTax: 58.03, netAmount: 161.97, currency: 'EUR', ledgerAccount: 'Income:Dividends:EUBank:SAP' },
];

export const PortfolioPage: React.FC = () => {
  const { holdings, wealthSummary, netWorthHistory, baseCurrency } = useOFinance();

  const [accountFilter, setAccountFilter] = useState('ALL');
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [assetTypeFilter, setAssetTypeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'marketValue' | 'returnPct' | 'unrealizedPnL'>('marketValue');
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedHolding, setSelectedHolding] = useState<PortfolioHolding | null>(null);
  const [analyticsTab, setAnalyticsTab] = useState<'risk' | 'dividends' | 'performance'>('risk');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedHolding(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const filteredHoldings = useMemo(() => {
    return holdings
      .filter((h) => {
        if (accountFilter !== 'ALL' && h.accountId !== accountFilter) return false;
        if (marketFilter !== 'ALL' && h.market !== marketFilter) return false;
        if (assetTypeFilter !== 'ALL' && h.assetType !== assetTypeFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const valA =
          sortBy === 'returnPct'
            ? a.returnPct
            : convertCurrency(a[sortBy], a.currency, baseCurrency);
        const valB =
          sortBy === 'returnPct'
            ? b.returnPct
            : convertCurrency(b[sortBy], b.currency, baseCurrency);
        return sortDesc ? valB - valA : valA - valB;
      });
  }, [holdings, accountFilter, marketFilter, assetTypeFilter, sortBy, sortDesc, baseCurrency]);

  // Portfolio Summary Metrics in baseCurrency
  const portfolioMetrics = useMemo(() => {
    let totalMarketVal = 0;
    let totalCostBasis = 0;
    let totalRealized = 0;
    let totalDividends = 0;

    for (const h of holdings) {
      totalMarketVal += convertCurrency(h.marketValue, h.currency, baseCurrency);
      totalCostBasis += convertCurrency(h.costBasisTotal, h.currency, baseCurrency);
      totalRealized += convertCurrency(h.realizedPnLYTD, h.currency, baseCurrency);
      totalDividends += convertCurrency(h.dividendsYTD, h.currency, baseCurrency);
    }

    const unrealizedPnL = totalMarketVal - totalCostBasis;
    const returnPct = totalCostBasis > 0 ? (unrealizedPnL / totalCostBasis) * 100 : 0;

    return {
      totalMarketVal,
      totalCostBasis,
      unrealizedPnL,
      returnPct,
      totalRealized,
      totalDividends,
    };
  }, [holdings, baseCurrency]);

  // Exposure breakdowns (Sector, Country)
  const sectorExposure = useMemo(() => {
    const map: Record<string, number> = {};
    for (const h of holdings) {
      const val = convertCurrency(h.marketValue, h.currency, baseCurrency);
      map[h.sector] = (map[h.sector] || 0) + val;
    }
    const total = portfolioMetrics.totalMarketVal || 1;
    return Object.entries(map)
      .map(([name, val]) => ({
        name,
        val: Math.round(val),
        pct: Number(((val / total) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [holdings, portfolioMetrics.totalMarketVal, baseCurrency]);

  const countryExposure = useMemo(() => {
    const map: Record<string, number> = {};
    for (const h of holdings) {
      const val = convertCurrency(h.marketValue, h.currency, baseCurrency);
      map[h.country] = (map[h.country] || 0) + val;
    }
    const total = portfolioMetrics.totalMarketVal || 1;
    return Object.entries(map)
      .map(([name, val]) => ({
        name,
        val: Math.round(val),
        pct: Number(((val / total) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [holdings, portfolioMetrics.totalMarketVal, baseCurrency]);

  const currencyExposure = useMemo(() => {
    const map: Record<string, number> = {};
    for (const h of holdings) {
      const val = convertCurrency(h.marketValue, h.currency, baseCurrency);
      map[h.currency] = (map[h.currency] || 0) + val;
    }
    const total = portfolioMetrics.totalMarketVal || 1;
    return Object.entries(map).map(([ccy, val]) => ({
      ccy,
      val,
      pct: Number(((val / total) * 100).toFixed(2)),
    }));
  }, [holdings, portfolioMetrics.totalMarketVal, baseCurrency]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
            Institutional Portfolio & Multi-Brokerage Holdings (DEMO)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Aggregated positions across Interactive Brokers, Charles Schwab, Firstrade, and Frankfurt Euro Depot. All market prices are simulated snapshots.
          </p>
        </div>
        <span className="text-xs font-mono text-amber-600 dark:text-amber-400">
          SIMULATED SNAPSHOT PRICES · NO LIVE MARKET FEED
        </span>
      </div>

      {/* Portfolio Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 font-mono">
        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500">Total Portfolio Value</div>
          <div className="text-base font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {formatCurrency(portfolioMetrics.totalMarketVal, baseCurrency)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Matches Overview Inv</div>
        </div>

        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500">Total Cost Basis</div>
          <div className="text-base font-semibold text-slate-900 dark:text-white mt-1 tabular-nums">
            {formatCurrency(portfolioMetrics.totalCostBasis, baseCurrency)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">17 Active Positions</div>
        </div>

        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500">Unrealized P&L</div>
          <div className="text-base font-semibold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {formatCurrency(portfolioMetrics.unrealizedPnL, baseCurrency, { showSign: true })}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
            {formatPercent(portfolioMetrics.returnPct)} Open Gain
          </div>
        </div>

        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500">Realized P&L (YTD)</div>
          <div className="text-base font-semibold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {formatCurrency(portfolioMetrics.totalRealized, baseCurrency, { showSign: true })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Closed Lots YTD</div>
        </div>

        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500">Dividends (YTD)</div>
          <div className="text-base font-semibold text-blue-600 dark:text-blue-400 mt-1 tabular-nums">
            {formatCurrency(portfolioMetrics.totalDividends, baseCurrency)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Cash & Reinvested</div>
        </div>

        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500">Total Cash Reserve</div>
          <div className="text-base font-semibold text-slate-900 dark:text-white mt-1 tabular-nums">
            {formatCurrency(wealthSummary.totalCash, baseCurrency)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Across 6 Accounts</div>
        </div>

        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500">Portfolio Return</div>
          <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {formatPercent(wealthSummary.overallReturnPct)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Total Return incl. Div</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-3 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter Holdings by Account"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          >
            <option value="ALL">All Investment Accounts (4)</option>
            <option value="acc-ibkr">Interactive Brokers ($312.5K)</option>
            <option value="acc-schwab">Charles Schwab ($198.7K)</option>
            <option value="acc-firstrade">Firstrade ($74.3K)</option>
            <option value="acc-eu-bank">Frankfurt Euro Depot (€28.5K)</option>
          </select>

          <select
            aria-label="Filter Holdings by Market"
            value={marketFilter}
            onChange={(e) => setMarketFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          >
            <option value="ALL">All Markets (US / EU / Global)</option>
            <option value="US">US Market</option>
            <option value="EU">European Market (XETRA / ADR)</option>
            <option value="Global">Global UCITS / ADR</option>
          </select>

          <select
            aria-label="Filter Holdings by Asset Class"
            value={assetTypeFilter}
            onChange={(e) => setAssetTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          >
            <option value="ALL">All Asset Classes</option>
            {ASSET_CLASSES.map((ac) => (
              <option key={ac} value={ac}>
                {ac}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <span className="text-slate-400">Sort by:</span>
          {(['marketValue', 'returnPct', 'unrealizedPnL'] as const).map((field) => (
            <button
              key={field}
              type="button"
              onClick={() => {
                if (sortBy === field) setSortDesc(!sortDesc);
                else {
                  setSortBy(field);
                  setSortDesc(true);
                }
              }}
              className={`px-2.5 py-1 rounded flex items-center gap-1 ${
                sortBy === field
                  ? 'bg-slate-900 text-white dark:bg-blue-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              <span>
                {field === 'marketValue' ? 'Value' : field === 'returnPct' ? 'Return %' : 'Unrealized P&L'}
              </span>
              <ArrowUpDown className="w-3 h-3" />
            </button>
          ))}
        </div>
      </div>

      {/* Holdings Table */}
      <div className="rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/40">
                <th className="py-2.5 px-3 font-medium">Symbol</th>
                <th className="py-2.5 px-3 font-medium">Security Name</th>
                <th className="py-2.5 px-3 font-medium">Asset Type</th>
                <th className="py-2.5 px-3 font-medium">Account</th>
                <th className="py-2.5 px-3 font-medium text-right">Quantity</th>
                <th className="py-2.5 px-3 font-medium text-right">Avg Cost</th>
                <th className="py-2.5 px-3 font-medium text-right">Current Price</th>
                <th className="py-2.5 px-3 font-medium text-right">Market Value</th>
                <th className="py-2.5 px-3 font-medium text-right">Unrealized P&L</th>
                <th className="py-2.5 px-3 font-medium text-right">Return %</th>
                <th className="py-2.5 px-2 font-medium">Ccy</th>
                <th className="py-2.5 px-3 font-medium text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredHoldings.map((h) => (
                <tr
                  key={h.id}
                  onClick={() => setSelectedHolding(h)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                >
                  <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    {h.symbol}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                    <div>{h.securityName}</div>
                    <div className="text-[10px] text-slate-400">
                      {h.sector} · {h.country}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {h.assetType}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {h.institution}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right tabular-nums">{h.quantity}</td>
                  <td className="py-2.5 px-3 font-mono text-right tabular-nums">
                    {formatCurrency(h.averageCost, h.currency)}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right tabular-nums">
                    {formatCurrency(h.currentPrice, h.currency)}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right font-semibold text-slate-900 dark:text-white tabular-nums">
                    {formatCurrency(h.marketValue, h.currency)}
                  </td>
                  <td
                    className={`py-2.5 px-3 font-mono text-right font-semibold tabular-nums ${
                      h.unrealizedPnL >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatCurrency(h.unrealizedPnL, h.currency, { showSign: true })}
                  </td>
                  <td
                    className={`py-2.5 px-3 font-mono text-right font-semibold tabular-nums ${
                      h.returnPct >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatPercent(h.returnPct)}
                  </td>
                  <td className="py-2.5 px-2 font-mono text-[11px] text-slate-500">{h.currency}</td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedHolding(h);
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 text-[11px]"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Lots</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sub-Navigation for Deep Portfolio Analytics (Risk/Exposure, Dividend History, Historical Performance) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2 text-xs font-mono">
          {[
            { id: 'risk', label: '1. Concentration Risk, Sector & Currency Exposure', icon: PieChart },
            { id: 'dividends', label: `2. Dividend Distribution History & Withholding Tax (${DIVIDEND_HISTORY_YTD.length})`, icon: DollarSign },
            { id: 'performance', label: '3. Historical Performance & Benchmark Attribution (12M)', icon: TrendingUp },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAnalyticsTab(tab.id as typeof analyticsTab)}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors ${
                  analyticsTab === tab.id
                    ? 'bg-slate-900 text-white dark:bg-blue-600'
                    : 'bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          Deterministic Portfolio Analytics · Base: {baseCurrency}
        </span>
      </div>

      {/* TAB 1: Risk, Concentration & Exposure Analytics */}
      {analyticsTab === 'risk' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Sector & Country Exposure (5 cols) */}
          <div className="lg:col-span-5 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Sector & Country Exposure (Simulated)
            </h2>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectorExposure.slice(0, 6)} layout="vertical" margin={{ left: 10, right: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} unit="%" />
                  <YAxis dataKey="name" type="category" width={135} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', fontSize: '11px', color: '#F8FAFC' }}
                    formatter={(val: unknown) => `${val}%`}
                  />
                  <Bar dataKey="pct" fill="#3B82F6" radius={[0, 3, 3, 0]}>
                    {sectorExposure.slice(0, 6).map((entry, idx) => (
                      <Cell key={idx} fill={entry.pct > 40 ? '#F59E0B' : '#3B82F6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs font-mono">
              <div className="text-[11px] font-semibold text-slate-400">Geographic & Currency Exposure</div>
              {countryExposure.map((c) => (
                <div key={c.name} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600 dark:text-slate-300">{c.name}</span>
                  <span className="tabular-nums">
                    {formatCurrency(c.val, baseCurrency, { compact: true })} ({c.pct}%)
                  </span>
                </div>
              ))}
              <div className="pt-1.5 mt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-blue-500">
                <span>Holdings Currency Split:</span>
                <span>
                  {currencyExposure.map((ce) => `${ce.ccy} ${ce.pct}%`).join(' · ')}
                </span>
              </div>
            </div>
          </div>

          {/* Top 10 Holdings Concentration (4 cols) */}
          <div className="lg:col-span-4 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Individual Position Concentration (Top 10)
              </h2>
              <span className="text-[11px] font-mono text-amber-500">Policy Cap: 12.0%</span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              {holdings
                .slice()
                .sort(
                  (a, b) =>
                    convertCurrency(b.marketValue, b.currency, baseCurrency) -
                    convertCurrency(a.marketValue, a.currency, baseCurrency)
                )
                .slice(0, 10)
                .map((h, i) => {
                  const valBase = convertCurrency(h.marketValue, h.currency, baseCurrency);
                  const weight = ((valBase / portfolioMetrics.totalMarketVal) * 100).toFixed(2);
                  const isOverCap = Number(weight) > 12.0;
                  return (
                    <div key={h.id} className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-700 dark:text-slate-300 truncate">
                        {i + 1}. <strong>{h.symbol}</strong> ({h.institution.split(' ')[0]})
                      </span>
                      <span
                        className={`tabular-nums ${
                          isOverCap
                            ? 'text-amber-600 dark:text-amber-400 font-bold'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {weight}% {isOverCap ? '(!)' : ''}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Risk Telemetry & Correlation Overview (3 cols) */}
          <div className="lg:col-span-3 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Risk & Correlation Metrics (SIMULATED)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                252-Day Historical Risk Estimates
              </p>
            </div>

            <div className="space-y-2.5 font-mono text-xs">
              <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex justify-between">
                <span className="text-slate-500">Portfolio Volatility</span>
                <span className="font-bold">11.40% ann.</span>
              </div>
              <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex justify-between">
                <span className="text-slate-500">Maximum Drawdown</span>
                <span className="font-bold text-rose-500">-4.82% (12M)</span>
              </div>
              <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex justify-between">
                <span className="text-slate-500">Sharpe Ratio (Rf=4.5%)</span>
                <span className="font-bold text-emerald-500">1.74</span>
              </div>
              <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex justify-between">
                <span className="text-slate-500">Beta vs S&P 500</span>
                <span className="font-bold">0.84</span>
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-[11px] font-mono space-y-1">
              <div className="text-slate-400 font-semibold">Pairwise Correlation (Sim)</div>
              <div className="flex justify-between">
                <span>NVDA ↔ TSM:</span>
                <span className="text-amber-500">+0.78 (High)</span>
              </div>
              <div className="flex justify-between">
                <span>VOO ↔ TLT:</span>
                <span className="text-emerald-500">-0.31 (Diversifier)</span>
              </div>
              <div className="flex justify-between">
                <span>VOO ↔ GLD:</span>
                <span className="text-blue-400">+0.08 (Uncorrelated)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Dividend Distribution History & Withholding Tax Ledger */}
      {analyticsTab === 'dividends' && (
        <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Dividend Distribution & Foreign Tax Withholding Ledger (YTD Simulated)
              </h2>
              <p className="text-[11px] text-slate-500">
                Tracks gross cash distributions, foreign ADR/XETRA withholding taxes, and net cash credited across all 4 investment accounts.
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              YTD Total Dividends ({baseCurrency}): {formatCurrency(portfolioMetrics.totalDividends, baseCurrency)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                  <th className="py-2 pr-3 font-medium">Dist ID</th>
                  <th className="py-2 px-3 font-medium">Ex-Date / Pay Date</th>
                  <th className="py-2 px-3 font-medium">Symbol & Security</th>
                  <th className="py-2 px-3 font-medium">Account</th>
                  <th className="py-2 px-3 font-medium text-right">Gross Div</th>
                  <th className="py-2 px-3 font-medium text-right">Tax Withheld</th>
                  <th className="py-2 px-3 font-medium text-right">Net Cash</th>
                  <th className="py-2 pl-3 font-medium">Beancount Income Account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-[11px]">
                {DIVIDEND_HISTORY_YTD.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 pr-3 text-blue-600 dark:text-blue-400 font-bold">{d.id}</td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {d.exDate} → {d.payDate}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{d.symbol}</span> ·{' '}
                      <span className="text-slate-600 dark:text-slate-300">{d.security}</span>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-300">{d.account}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {formatCurrency(d.grossAmount, d.currency as 'USD' | 'EUR')} {d.currency}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-rose-500">
                      {d.withholdingTax > 0
                        ? `-${formatCurrency(d.withholdingTax, d.currency as 'USD' | 'EUR')}`
                        : '0.00'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(d.netAmount, d.currency as 'USD' | 'EUR')} {d.currency}
                    </td>
                    <td className="py-2.5 pl-3 text-slate-500">{d.ledgerAccount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: 12-Month Historical Performance & Benchmark Attribution */}
      {analyticsTab === 'performance' && (
        <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                12-Month Historical Portfolio Performance & Benchmark Attribution (SIMULATED)
              </h2>
              <p className="text-[11px] text-slate-500">
                Deterministic monthly progression of Investment Value, Cash Reserves, Cumulative Portfolio Return %, and Alpha vs. S&P 500 & Global 60/40.
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              12M Cumulative Portfolio Return: +24.80% (vs S&P 500 +18.90%)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                  <th className="py-2 pr-3 font-medium">Month</th>
                  <th className="py-2 px-3 font-medium text-right">Investments (USD)</th>
                  <th className="py-2 px-3 font-medium text-right">Cash (USD)</th>
                  <th className="py-2 px-3 font-medium text-right">Net Worth (USD)</th>
                  <th className="py-2 px-3 font-medium text-right">Cum. Portfolio %</th>
                  <th className="py-2 px-3 font-medium text-right">S&P 500 %</th>
                  <th className="py-2 px-3 font-medium text-right">Global 60/40 %</th>
                  <th className="py-2 pl-3 font-medium text-right">Active Alpha vs S&P</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-[11px]">
                {netWorthHistory.map((pt) => {
                  const alpha = Number((pt.portfolioReturnPct - pt.benchmarkReturnPct).toFixed(2));
                  return (
                    <tr key={pt.date} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 pr-3 font-bold text-slate-800 dark:text-slate-200">{pt.label} ({pt.date})</td>
                      <td className="py-2 px-3 text-right tabular-nums text-blue-600 dark:text-blue-400">
                        {formatCurrency(pt.investmentsUSD, 'USD')}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {formatCurrency(pt.cashUSD, 'USD')}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900 dark:text-white">
                        {formatCurrency(pt.netWorthUSD, 'USD')}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                        {formatPercent(pt.portfolioReturnPct)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-500">
                        {formatPercent(pt.benchmarkReturnPct)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-500">
                        {formatPercent(Number((pt.benchmarkReturnPct * 0.85).toFixed(2)))}
                      </td>
                      <td className="py-2 pl-3 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatPercent(alpha)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Holding Lot & Change History Modal */}
      {selectedHolding && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Holding Position Details"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-700 rounded max-w-xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                  {selectedHolding.symbol} · {selectedHolding.securityName} (DEMO POSITION)
                </h3>
                <p className="text-[11px] font-mono text-slate-500">
                  {selectedHolding.accountName} · Last Price Update: {selectedHolding.lastPriceUpdate}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close position modal"
                onClick={() => setSelectedHolding(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 block">Shares / Qty</span>
                <span className="font-bold">{selectedHolding.quantity}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Average Cost</span>
                <span>
                  {formatCurrency(selectedHolding.averageCost, selectedHolding.currency)}{' '}
                  {selectedHolding.currency}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Current Price (Sim)</span>
                <span className="font-bold">
                  {formatCurrency(selectedHolding.currentPrice, selectedHolding.currency)}{' '}
                  {selectedHolding.currency}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Market Value</span>
                <span className="font-bold">
                  {formatCurrency(selectedHolding.marketValue, selectedHolding.currency)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Unrealized P&L</span>
                <span className="text-emerald-500 font-bold">
                  {formatCurrency(selectedHolding.unrealizedPnL, selectedHolding.currency, { showSign: true })}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">YTD Dividends</span>
                <span>{formatCurrency(selectedHolding.dividendsYTD, selectedHolding.currency)}</span>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Position Lot & Change History (Simulated)
              </div>
              <div className="space-y-1.5 font-mono text-xs">
                {selectedHolding.recentChanges.map((ch, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                  >
                    <span>
                      {ch.date} · <strong>{ch.action}</strong>
                    </span>
                    <span>
                      {ch.shares > 0 ? `${ch.shares} shares @ ` : '@ '}
                      {formatCurrency(ch.price, selectedHolding.currency)} {selectedHolding.currency}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedHolding(null)}
                className="px-4 py-1.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
