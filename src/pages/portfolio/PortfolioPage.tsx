import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useOFinance } from '../../app/providers/OFinanceContext';
import { AssetClass, PortfolioHolding } from '../../types';
import { convertCurrency, formatCurrency, formatPercent } from '../../utils/finance';
import { ArrowUpDown, Eye, X } from 'lucide-react';

const ASSET_CLASSES: AssetClass[] = [
  'US Equities',
  'International Equities',
  'ETFs',
  'Bonds',
  'REITs',
  'Crypto',
  'Other Assets',
];

export const PortfolioPage: React.FC = () => {
  const { holdings, wealthSummary, baseCurrency } = useOFinance();

  const [accountFilter, setAccountFilter] = useState('ALL');
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [assetTypeFilter, setAssetTypeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'marketValue' | 'returnPct' | 'unrealizedPnL'>('marketValue');
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedHolding, setSelectedHolding] = useState<PortfolioHolding | null>(null);

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

  // Exposure breakdowns (Sector, Country, Asset Class, Top 10 Concentration)
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

      {/* 9.1 Portfolio Summary Strip */}
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

      {/* 9.2 Holdings Table */}
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

      {/* 9.4 Risk, Concentration & Exposure Analytics */}
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
                  formatter={(val: number) => `${val}%`}
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
            <div className="text-[11px] font-semibold text-slate-400">Geographic Exposure</div>
            {countryExposure.map((c) => (
              <div key={c.name} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600 dark:text-slate-300">{c.name}</span>
                <span className="tabular-nums">
                  {formatCurrency(c.val, baseCurrency, { compact: true })} ({c.pct}%)
                </span>
              </div>
            ))}
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
