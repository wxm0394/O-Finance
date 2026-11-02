import {
  CurrencyCode,
  FinancialAccount,
  PortfolioHolding,
  TransactionRecord,
  BacktestExperiment,
} from '../types';

/**
 * Deterministic Simulated FX Rates (Base = USD)
 * Explicitly marked as SIMULATED FX DATA as of 2026-11-02
 */
export const SIMULATED_FX_RATES_TO_USD: Record<CurrencyCode, number> = {
  USD: 1.0,
  GBP: 1.285, // 1 GBP = 1.285 USD
  EUR: 1.092, // 1 EUR = 1.092 USD
};

export const FX_LAST_UPDATED = '2026-11-02 14:30:00 UTC (SIMULATED FX)';

/**
 * Convert an amount from `fromCurrency` to `toCurrency` deterministically.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  ratesToUsd: Record<CurrencyCode, number> = SIMULATED_FX_RATES_TO_USD
): number {
  if (fromCurrency === toCurrency) {
    return round2(amount);
  }
  const amountInUsd = amount * ratesToUsd[fromCurrency];
  const converted = amountInUsd / ratesToUsd[toCurrency];
  return round2(converted);
}

export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Format a numeric value as a currency string with deterministic symbols.
 */
export function formatCurrency(
  amount: number,
  currency: CurrencyCode = 'USD',
  options?: { compact?: boolean; showSign?: boolean }
): string {
  const symbols: Record<CurrencyCode, string> = {
    USD: '$',
    GBP: '£',
    EUR: '€',
  };
  const symbol = symbols[currency] || '$';
  const absVal = Math.abs(amount);
  const sign = amount < 0 ? '-' : options?.showSign && amount > 0 ? '+' : '';

  if (options?.compact && absVal >= 1_000_000) {
    return `${sign}${symbol}${(absVal / 1_000_000).toFixed(2)}M`;
  }
  if (options?.compact && absVal >= 10_000) {
    return `${sign}${symbol}${(absVal / 1_000).toFixed(1)}K`;
  }

  return `${sign}${symbol}${absVal.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(pct: number, showSign = true): string {
  const sign = pct > 0 && showSign ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

/**
 * Deterministically aggregate account balances in target base currency.
 * Ensures Overview Total Cash == sum of Accounts availableCash,
 * Overview Total Investments == sum of Accounts investmentValue == sum of Portfolio holdings,
 * Overview Total Net Worth == Total Cash + Total Investments - Total Liabilities.
 */
export interface AggregatedWealthSummary {
  baseCurrency: CurrencyCode;
  totalNetWorth: number;
  totalCash: number;
  totalInvestments: number;
  totalLiabilities: number;
  dailyPnL: number;
  dailyPnLPct: number;
  monthlyPnL: number;
  monthlyPnLPct: number;
  overallReturn: number;
  overallReturnPct: number;
  currencyExposure: {
    currency: CurrencyCode;
    amountInBase: number;
    weightPct: number;
  }[];
}

export function calculateWealthSummary(
  accounts: FinancialAccount[],
  holdings: PortfolioHolding[],
  baseCurrency: CurrencyCode
): AggregatedWealthSummary {
  let totalCash = 0;
  let totalLiabilities = 0;

  const byNativeCurrency: Record<CurrencyCode, number> = {
    USD: 0,
    GBP: 0,
    EUR: 0,
  };

  for (const acc of accounts) {
    const cashInBase = convertCurrency(acc.availableCash, acc.currency, baseCurrency);
    const liabInBase = convertCurrency(acc.liabilityAmount, acc.currency, baseCurrency);
    totalCash += cashInBase;
    totalLiabilities += liabInBase;

    const netAccInBase =
      convertCurrency(acc.availableCash + acc.investmentValue - acc.liabilityAmount, acc.currency, baseCurrency);
    byNativeCurrency[acc.currency] += netAccInBase;
  }

  // Calculate investments strictly from holdings so Overview and Portfolio match 100%
  let totalInvestments = 0;
  let totalCostBasis = 0;
  let totalRealizedAndDiv = 0;

  for (const h of holdings) {
    totalInvestments += convertCurrency(h.marketValue, h.currency, baseCurrency);
    totalCostBasis += convertCurrency(h.costBasisTotal, h.currency, baseCurrency);
    totalRealizedAndDiv += convertCurrency(h.realizedPnLYTD + h.dividendsYTD, h.currency, baseCurrency);
  }

  totalCash = round2(totalCash);
  totalInvestments = round2(totalInvestments);
  totalLiabilities = round2(totalLiabilities);

  const totalNetWorth = round2(totalCash + totalInvestments - totalLiabilities);

  const unrealizedPnL = round2(totalInvestments - totalCostBasis);
  const overallReturn = round2(unrealizedPnL + totalRealizedAndDiv);
  const overallReturnPct = totalCostBasis > 0 ? round2((overallReturn / totalCostBasis) * 100) : 0;

  // Deterministic simulated daily & monthly P&L derived from portfolio value
  const dailyPnL = round2(totalInvestments * 0.0064);
  const dailyPnLPct = round2((dailyPnL / (totalNetWorth - dailyPnL)) * 100);

  const monthlyPnL = round2(totalInvestments * 0.0315);
  const monthlyPnLPct = round2((monthlyPnL / (totalNetWorth - monthlyPnL)) * 100);

  const totalPositiveExposure = Math.max(
    1,
    byNativeCurrency.USD + byNativeCurrency.GBP + byNativeCurrency.EUR
  );

  const currencyExposure: { currency: CurrencyCode; amountInBase: number; weightPct: number }[] = (
    ['USD', 'GBP', 'EUR'] as CurrencyCode[]
  ).map((curr) => ({
    currency: curr,
    amountInBase: round2(byNativeCurrency[curr]),
    weightPct: round2((byNativeCurrency[curr] / totalPositiveExposure) * 100),
  }));

  return {
    baseCurrency,
    totalNetWorth,
    totalCash,
    totalInvestments,
    totalLiabilities,
    dailyPnL,
    dailyPnLPct,
    monthlyPnL,
    monthlyPnLPct,
    overallReturn,
    overallReturnPct,
    currencyExposure,
  };
}

/**
 * Deterministic Cash Flow calculation that excludes internal transfers (`Transfer` or `transferGroupId`)
 * so cross-account transfers are never double-counted as income or expense.
 */
export function calculateCashFlowTotals(
  transactions: TransactionRecord[],
  baseCurrency: CurrencyCode
): {
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  excludedTransferVolume: number;
  transferPairCount: number;
} {
  let totalInflow = 0;
  let totalOutflow = 0;
  let excludedTransferVolume = 0;
  const transferGroups = new Set<string>();

  for (const tx of transactions) {
    const absAmountInBase = convertCurrency(Math.abs(tx.amount), tx.currency, baseCurrency);

    if (tx.type === 'Transfer' || tx.direction === 'Internal Transfer' || tx.transferGroupId) {
      if (tx.transferGroupId) {
        if (!transferGroups.has(tx.transferGroupId)) {
          transferGroups.add(tx.transferGroupId);
          excludedTransferVolume += absAmountInBase;
        }
      } else {
        excludedTransferVolume += absAmountInBase * 0.5;
      }
      continue;
    }

    if (tx.amount > 0) {
      totalInflow += absAmountInBase;
    } else if (tx.amount < 0) {
      totalOutflow += absAmountInBase;
    }
  }

  return {
    totalInflow: round2(totalInflow),
    totalOutflow: round2(totalOutflow),
    netCashFlow: round2(totalInflow - totalOutflow),
    excludedTransferVolume: round2(excludedTransferVolume),
    transferPairCount: transferGroups.size,
  };
}

/**
 * Deterministic Backtest Simulator (Pure Function)
 * Generates reproducible equity curve, drawdown, and risk-adjusted metrics based on parameters.
 */
export function runDeterministicBacktest(params: {
  strategyId: string;
  strategyName: string;
  symbol: string;
  benchmark: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  commissionBps: number;
  slippageBps: number;
}): BacktestExperiment {
  const seedStr = `${params.strategyId}-${params.symbol}-${params.initialCapital}-${params.commissionBps}-${params.slippageBps}`;
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const normalizedSeed = Math.abs(hash % 1000) / 1000;

  const months = [
    '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05',
    '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11',
  ];

  const frictionDrag = (params.commissionBps + params.slippageBps) * 0.0004;
  let stratEq = params.initialCapital;
  let benchEq = params.initialCapital;
  let peakEq = stratEq;
  let maxDd = 0;

  const equityCurve: { date: string; strategyEquity: number; benchmarkEquity: number; drawdownPct: number }[] = [];
  const monthlyReturns: { month: string; returnPct: number }[] = [];

  const baseMonthlyPattern = [0.024, -0.011, 0.032, 0.018, -0.019, 0.029, 0.015, -0.008, 0.036, 0.012, 0.027, 0.019];
  const benchPattern = [0.018, -0.015, 0.021, 0.011, -0.022, 0.019, 0.009, -0.012, 0.025, 0.007, 0.019, 0.014];

  let wins = 0;
  let grossGain = 0;
  let grossLoss = 0;

  months.forEach((m, idx) => {
    const mod = ((idx + 1) * normalizedSeed * 0.012) - 0.004;
    const rStrat = round2((baseMonthlyPattern[idx] + mod - frictionDrag) * 100) / 100;
    const rBench = benchPattern[idx];

    stratEq = round2(stratEq * (1 + rStrat));
    benchEq = round2(benchEq * (1 + rBench));

    if (stratEq > peakEq) peakEq = stratEq;
    const dd = round2(((stratEq - peakEq) / peakEq) * 100);
    if (dd < maxDd) maxDd = dd;

    if (rStrat > 0) {
      wins++;
      grossGain += rStrat;
    } else {
      grossLoss += Math.abs(rStrat);
    }

    equityCurve.push({
      date: m,
      strategyEquity: stratEq,
      benchmarkEquity: benchEq,
      drawdownPct: dd,
    });

    monthlyReturns.push({
      month: m,
      returnPct: round2(rStrat * 100),
    });
  });

  const totalReturnPct = round2(((stratEq - params.initialCapital) / params.initialCapital) * 100);
  const benchmarkReturnPct = round2(((benchEq - params.initialCapital) / params.initialCapital) * 100);
  const annualizedReturnPct = round2(totalReturnPct * 0.96);
  const sharpeRatio = round2(1.45 + normalizedSeed * 0.55 - frictionDrag * 10);
  const sortinoRatio = round2(sharpeRatio * 1.38);
  const winRatePct = round2((wins / months.length) * 100);
  const profitFactor = grossLoss > 0 ? round2(grossGain / grossLoss) : 2.85;

  return {
    id: `EXP-${Date.now().toString().slice(-6)}`,
    strategyId: params.strategyId,
    strategyName: params.strategyName,
    symbol: params.symbol,
    benchmark: params.benchmark,
    startDate: params.startDate,
    endDate: params.endDate,
    initialCapital: params.initialCapital,
    commissionBps: params.commissionBps,
    slippageBps: params.slippageBps,
    parameters: `Cap=${params.initialCapital}, Comm=${params.commissionBps}bps, Slip=${params.slippageBps}bps`,
    dataset: `DuckDB Local Parquet · ${params.symbol} Daily OHLCV (Simulated)`,
    executionTimeMs: 420,
    createdAt: '2026-11-02 15:04:12 UTC',
    status: 'Completed (Simulated)',
    metrics: {
      totalReturnPct,
      annualizedReturnPct,
      benchmarkReturnPct,
      sharpeRatio,
      sortinoRatio,
      maxDrawdownPct: maxDd,
      winRatePct,
      profitFactor,
    },
    equityCurve,
    monthlyReturns,
  };
}
