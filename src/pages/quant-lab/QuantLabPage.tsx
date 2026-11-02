import React, { useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { useOFinance } from '../../app/providers/OFinanceContext';
import { formatCurrency, formatPercent } from '../../utils/finance';
import { Play, FlaskConical, Code2, History } from 'lucide-react';

export const QuantLabPage: React.FC = () => {
  const { strategies, backtests, runSimulatedBacktest } = useOFinance();

  const [selectedStrategyId, setSelectedStrategyId] = useState(strategies[0].id);
  const [symbol, setSymbol] = useState('SPY');
  const [benchmark, setBenchmark] = useState('SPY');
  const [startDate, setStartDate] = useState('2025-11-01');
  const [endDate, setEndDate] = useState('2026-11-01');
  const [initialCapital, setInitialCapital] = useState(100000);
  const [commissionBps, setCommissionBps] = useState(5);
  const [slippageBps, setSlippageBps] = useState(2);

  const [activeExperimentId, setActiveExperimentId] = useState(backtests[0].id);
  const [isRunning, setIsRunning] = useState(false);

  const currentStrategy =
    strategies.find((s) => s.id === selectedStrategyId) || strategies[0];
  const activeExp =
    backtests.find((b) => b.id === activeExperimentId) || backtests[0];

  const handleRunBacktest = (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunning(true);
    setTimeout(() => {
      const newExp = runSimulatedBacktest({
        strategyId: selectedStrategyId,
        symbol,
        benchmark,
        startDate,
        endDate,
        initialCapital: Number(initialCapital) || 100000,
        commissionBps: Number(commissionBps) || 0,
        slippageBps: Number(slippageBps) || 0,
      });
      setActiveExperimentId(newExp.id);
      setIsRunning(false);
    }, 320);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
            Quantitative Strategy Research & Backtest Lab (SIMULATED)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Systematic strategy definition, parameterized backtesting, risk attribution, and experiment tracking (DuckDB + Parquet target architecture).
          </p>
        </div>
        <span className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-mono font-semibold">
          SIMULATED BACKTEST ENGINE · NO REAL TRADING PROMISE
        </span>
      </div>

      {/* Top Split: 11.1 Strategy Library (5 cols) + 11.2 Backtest Runner Form (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 11.1 Strategy Library & Code Preview */}
        <div className="lg:col-span-5 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3 flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <FlaskConical className="w-4 h-4 text-blue-500" />
                <span>Strategy Library ({strategies.length} Models)</span>
              </h2>
              <span className="text-[11px] font-mono text-slate-400">Polars / DuckDB Syntax</span>
            </div>

            <div className="space-y-1.5">
              {strategies.map((strat) => (
                <button
                  key={strat.id}
                  type="button"
                  onClick={() => {
                    setSelectedStrategyId(strat.id);
                    setSymbol(strat.defaultSymbol);
                    setBenchmark(strat.defaultBenchmark);
                  }}
                  className={`w-full text-left p-2.5 rounded border text-xs transition-colors ${
                    selectedStrategyId === strat.id
                      ? 'bg-blue-600/10 border-blue-500/40 text-slate-900 dark:text-white'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>{strat.name}</span>
                    <span className="font-mono text-[10px] text-blue-500">{strat.category}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    {strat.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span className="flex items-center gap-1">
                <Code2 className="w-3.5 h-3.5" />
                <span>Strategy Signal Definition</span>
              </span>
              <span>{currentStrategy.rebalanceFreq}</span>
            </div>
            <pre className="p-2.5 rounded bg-slate-950 text-emerald-400 font-mono text-[10px] overflow-x-auto">
              {currentStrategy.codeSnippet}
            </pre>
          </div>
        </div>

        {/* 11.2 Backtest Configuration & Execution */}
        <div className="lg:col-span-7 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Parameterized Backtest Configuration (SIMULATED)
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Configure capital, transaction costs, and date horizon to generate a reproducible experiment record.
            </p>
          </div>

          <form onSubmit={handleRunBacktest} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-slate-500 mb-1">Selected Strategy</label>
              <select
                aria-label="Strategy Selector"
                value={selectedStrategyId}
                onChange={(e) => setSelectedStrategyId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-medium"
              >
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Target Symbol / Basket</label>
              <select
                aria-label="Symbol Selector"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold"
              >
                {['SPY', 'QQQ', 'NVDA', 'MSFT', 'VWRA', 'VOO', 'TSM', 'ASML', 'GLD'].map((sym) => (
                  <option key={sym} value={sym}>
                    {sym}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Start Date</label>
              <input
                type="date"
                aria-label="Backtest Start Date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">End Date</label>
              <input
                type="date"
                aria-label="Backtest End Date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Benchmark Symbol</label>
              <select
                aria-label="Benchmark Selector"
                value={benchmark}
                onChange={(e) => setBenchmark(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
              >
                <option value="SPY">SPY (S&P 500)</option>
                <option value="QQQ">QQQ (NASDAQ-100)</option>
                <option value="VWRA">VWRA (FTSE All-World)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Initial Capital (USD)</label>
              <input
                type="number"
                aria-label="Initial Capital"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Commission (bps)</label>
              <input
                type="number"
                aria-label="Commission bps"
                value={commissionBps}
                onChange={(e) => setCommissionBps(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Slippage (bps)</label>
              <input
                type="number"
                aria-label="Slippage bps"
                value={slippageBps}
                onChange={(e) => setSlippageBps(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
              />
            </div>

            <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                  1. Parquet Loaded ({symbol})
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                  2. Vectorized Signal
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                  3. Friction: {commissionBps + slippageBps} bps
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-semibold ${
                    isRunning
                      ? 'bg-blue-500/15 text-blue-500'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  Execution Status: {isRunning ? 'Running Simulation...' : activeExp.status} ({activeExp.executionTimeMs}ms)
                </span>
              </div>
              <button
                type="submit"
                disabled={isRunning}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isRunning ? 'Executing Simulation...' : 'Run Backtest (Simulated)'}</span>
              </button>
            </div>
          </form>

          {/* 11.3 Active Backtest Results KPI Strip */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-slate-900 dark:text-white">
                Active Experiment Result: <span className="font-mono text-blue-500">{activeExp.id}</span> ({activeExp.strategyName} · {activeExp.symbol})
              </span>
              <span className="font-mono text-[11px] text-amber-500">SIMULATED RESULT</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 font-mono text-xs">
              <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Total Return</div>
                <div className="font-bold text-emerald-500 tabular-nums">
                  {formatPercent(activeExp.metrics.totalReturnPct)}
                </div>
              </div>
              <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Ann. Return</div>
                <div className="font-bold text-emerald-500 tabular-nums">
                  {formatPercent(activeExp.metrics.annualizedReturnPct)}
                </div>
              </div>
              <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Benchmark</div>
                <div className="font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                  {formatPercent(activeExp.metrics.benchmarkReturnPct)}
                </div>
              </div>
              <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Sharpe Ratio</div>
                <div className="font-bold text-blue-500 tabular-nums">
                  {activeExp.metrics.sharpeRatio.toFixed(2)}
                </div>
              </div>
              <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Sortino Ratio</div>
                <div className="font-bold text-blue-500 tabular-nums">
                  {activeExp.metrics.sortinoRatio.toFixed(2)}
                </div>
              </div>
              <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Max Drawdown</div>
                <div className="font-bold text-rose-500 tabular-nums">
                  {activeExp.metrics.maxDrawdownPct.toFixed(2)}%
                </div>
              </div>
              <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Win Rate</div>
                <div className="font-bold tabular-nums">{activeExp.metrics.winRatePct.toFixed(1)}%</div>
              </div>
              <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Profit Factor</div>
                <div className="font-bold tabular-nums">{activeExp.metrics.profitFactor.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 11.3 Charts: Equity Curve vs Benchmark, Drawdown Curve, Monthly Returns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Equity Curve vs Benchmark (5 cols) */}
        <div className="lg:col-span-5 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="mb-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Simulated Equity Curve vs Benchmark ({activeExp.id})
            </h3>
            <p className="text-[11px] text-slate-500">
              Initial Capital: {formatCurrency(activeExp.initialCapital, 'USD')}
            </p>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activeExp.equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94A3B8' }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', fontSize: '11px', color: '#F8FAFC' }}
                  formatter={(val: unknown) => formatCurrency(Number(val) || 0, 'USD')}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line
                  type="monotone"
                  dataKey="strategyEquity"
                  name="Strategy (Sim)"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="benchmarkEquity"
                  name={`Benchmark (${activeExp.benchmark})`}
                  stroke="#94A3B8"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Underwater Drawdown Curve (3 cols) */}
        <div className="lg:col-span-3 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="mb-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Drawdown Curve (SIMULATED)
            </h3>
            <p className="text-[11px] text-slate-500">Peak-to-trough underwater %</p>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activeExp.equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', fontSize: '11px', color: '#F8FAFC' }}
                  formatter={(val: unknown) => `${val}%`}
                />
                <Area
                  type="monotone"
                  dataKey="drawdownPct"
                  name="Drawdown %"
                  stroke="#EF4444"
                  fill="#EF4444"
                  fillOpacity={0.25}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Returns Distribution (4 cols) */}
        <div className="lg:col-span-4 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="mb-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Monthly Return Distribution (%)
            </h3>
            <p className="text-[11px] text-slate-500">Net of {activeExp.commissionBps}bps comm + {activeExp.slippageBps}bps slip</p>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeExp.monthlyReturns}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', fontSize: '11px', color: '#F8FAFC' }}
                  formatter={(val: unknown) => `${val}%`}
                />
                <Bar dataKey="returnPct" name="Monthly Return %">
                  {activeExp.monthlyReturns.map((entry, idx) => (
                    <Cell key={idx} fill={entry.returnPct >= 0 ? '#10B981' : '#EF4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 11.4 Experiment History Table */}
      <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
            <History className="w-4 h-4 text-blue-500" />
            <span>Research Experiment Registry ({backtests.length} Simulated Runs · Click Row to Load)</span>
          </h2>
          <span className="text-xs font-mono text-slate-400">
            Target Storage: DuckDB + Parquet Experiment Store
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                <th className="py-2 pr-3 font-medium">Experiment ID</th>
                <th className="py-2 px-3 font-medium">Strategy</th>
                <th className="py-2 px-3 font-medium">Symbol</th>
                <th className="py-2 px-3 font-medium">Parameters</th>
                <th className="py-2 px-3 font-medium text-right">Total Return</th>
                <th className="py-2 px-3 font-medium text-right">Sharpe</th>
                <th className="py-2 px-3 font-medium text-right">Max DD</th>
                <th className="py-2 px-3 font-medium text-right">Exec Time</th>
                <th className="py-2 pl-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-mono text-[11px]">
              {backtests.map((exp) => (
                <tr
                  key={exp.id}
                  onClick={() => setActiveExperimentId(exp.id)}
                  className={`cursor-pointer transition-colors ${
                    activeExperimentId === exp.id
                      ? 'bg-blue-600/10'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <td className="py-2.5 pr-3 font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    {exp.id}
                  </td>
                  <td className="py-2.5 px-3 font-sans font-medium text-slate-900 dark:text-slate-100">
                    {exp.strategyName}
                  </td>
                  <td className="py-2.5 px-3 font-bold">{exp.symbol}</td>
                  <td className="py-2.5 px-3 text-slate-500 truncate max-w-[200px]">{exp.parameters}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
                    {formatPercent(exp.metrics.totalReturnPct)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {exp.metrics.sharpeRatio.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-rose-500 tabular-nums">
                    {exp.metrics.maxDrawdownPct.toFixed(2)}%
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-500 tabular-nums">
                    {exp.executionTimeMs}ms
                  </td>
                  <td className="py-2.5 pl-3 text-right text-emerald-600 dark:text-emerald-400">
                    {exp.status}
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
