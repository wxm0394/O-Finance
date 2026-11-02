import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertCurrency,
  calculateWealthSummary,
  calculateCashFlowTotals,
  runDeterministicBacktest,
  SIMULATED_FX_RATES_TO_USD,
} from './finance';
import { FinancialAccount, PortfolioHolding, TransactionRecord } from '../types';

test('deterministic currency conversion is accurate and reversible within rounding', () => {
  const usdFromGbp = convertCurrency(1000, 'GBP', 'USD', SIMULATED_FX_RATES_TO_USD);
  assert.equal(usdFromGbp, 1285.0);

  const usdFromEur = convertCurrency(1000, 'EUR', 'USD', SIMULATED_FX_RATES_TO_USD);
  assert.equal(usdFromEur, 1092.0);

  const sameCurr = convertCurrency(543.21, 'USD', 'USD', SIMULATED_FX_RATES_TO_USD);
  assert.equal(sameCurr, 543.21);
});

test('wealth summary deterministically reconciles cash, investments, and liabilities across currencies', () => {
  const mockAccounts: FinancialAccount[] = [
    {
      id: 'acc-1',
      institution: 'Interactive Brokers',
      accountName: 'IBKR Pro',
      accountNumberMasked: '****1001',
      accountType: 'Brokerage',
      currency: 'USD',
      currentBalance: 110000,
      availableCash: 10000,
      investmentValue: 100000,
      liabilityAmount: 0,
      lastSync: '2026-11-02 14:00',
      connectionStatus: 'Demo Only',
      dataFreshness: 'Simulated Live',
      region: 'US',
      connectorId: 'conn-ibkr',
    },
    {
      id: 'acc-2',
      institution: 'UK Bank',
      accountName: 'Barclays Premier',
      accountNumberMasked: '****2002',
      accountType: 'Checking',
      currency: 'GBP',
      currentBalance: 10000,
      availableCash: 10000, // 12,850 USD
      investmentValue: 0,
      liabilityAmount: 1000, // 1,285 USD
      lastSync: '2026-11-02 14:00',
      connectionStatus: 'Demo Only',
      dataFreshness: 'Simulated Live',
      region: 'UK',
      connectorId: 'conn-uk',
    },
  ];

  const mockHoldings: PortfolioHolding[] = [
    {
      id: 'h-1',
      symbol: 'AAPL',
      securityName: 'Apple Inc.',
      assetType: 'US Equities',
      accountId: 'acc-1',
      accountName: 'IBKR Pro',
      institution: 'Interactive Brokers',
      market: 'US',
      sector: 'Technology',
      country: 'United States',
      quantity: 400,
      averageCost: 200,
      currentPrice: 250,
      marketValue: 100000,
      costBasisTotal: 80000,
      unrealizedPnL: 20000,
      returnPct: 25,
      realizedPnLYTD: 1500,
      dividendsYTD: 500,
      currency: 'USD',
      lastPriceUpdate: '2026-11-02',
      recentChanges: [],
    },
  ];

  const summary = calculateWealthSummary(mockAccounts, mockHoldings, 'USD');
  assert.equal(summary.totalCash, 22850.0);
  assert.equal(summary.totalInvestments, 100000.0);
  assert.equal(summary.totalLiabilities, 1285.0);
  assert.equal(summary.totalNetWorth, 121565.0);
  assert.equal(summary.overallReturn, 22000.0);
});

test('cash flow calculation excludes cross-account internal transfers from inflow and outflow', () => {
  const txs: TransactionRecord[] = [
    {
      id: 'tx-1',
      date: '2026-10-28',
      institution: 'US Bank',
      accountId: 'acc-us',
      accountName: 'US Checking',
      description: 'Salary Payroll Deposit',
      payee: 'Employer Corp',
      fees: 0,
      amount: 8500,
      currency: 'USD',
      type: 'Deposit',
      category: 'Income:Salary',
      direction: 'Inflow',
      status: 'Settled',
      ledgerStatus: 'Posted',
      rawSourceJson: '{}',
      dataSource: 'Plaid Mock',
    },
    {
      id: 'tx-2',
      date: '2026-10-29',
      institution: 'US Bank',
      accountId: 'acc-us',
      accountName: 'US Checking',
      description: 'Transfer Out to IBKR Brokerage',
      payee: 'Interactive Brokers',
      fees: 0,
      amount: -5000,
      currency: 'USD',
      type: 'Transfer',
      category: 'Transfer:Internal',
      direction: 'Internal Transfer',
      transferGroupId: 'XFER-101',
      status: 'Settled',
      ledgerStatus: 'Posted',
      rawSourceJson: '{}',
      dataSource: 'Plaid Mock',
    },
    {
      id: 'tx-3',
      date: '2026-10-29',
      institution: 'Interactive Brokers',
      accountId: 'acc-ibkr',
      accountName: 'IBKR Pro',
      description: 'Transfer In from US Checking',
      payee: 'US Bank',
      fees: 0,
      amount: 5000,
      currency: 'USD',
      type: 'Transfer',
      category: 'Transfer:Internal',
      direction: 'Internal Transfer',
      transferGroupId: 'XFER-101',
      status: 'Settled',
      ledgerStatus: 'Posted',
      rawSourceJson: '{}',
      dataSource: 'IBKR Flex Mock',
    },
    {
      id: 'tx-4',
      date: '2026-10-30',
      institution: 'US Bank',
      accountId: 'acc-us',
      accountName: 'US Checking',
      description: 'Apartment Rent Payment',
      payee: 'Metropolitan Properties',
      fees: 0,
      amount: -2500,
      currency: 'USD',
      type: 'Withdrawal',
      category: 'Expenses:Housing',
      direction: 'Outflow',
      status: 'Settled',
      ledgerStatus: 'Posted',
      rawSourceJson: '{}',
      dataSource: 'Plaid Mock',
    },
  ];

  const flow = calculateCashFlowTotals(txs, 'USD');
  assert.equal(flow.totalInflow, 8500);
  assert.equal(flow.totalOutflow, 2500);
  assert.equal(flow.netCashFlow, 6000);
  assert.equal(flow.excludedTransferVolume, 5000);
  assert.equal(flow.transferPairCount, 1);
});

test('deterministic backtest produces 12 months of equity curve and valid risk ratios', () => {
  const exp = runDeterministicBacktest({
    strategyId: 'strat-ma-cross',
    strategyName: 'Moving Average Crossover',
    symbol: 'SPY',
    benchmark: 'SPY',
    startDate: '2025-11-01',
    endDate: '2026-11-01',
    initialCapital: 100000,
    commissionBps: 5,
    slippageBps: 2,
  });

  assert.equal(exp.equityCurve.length, 12);
  assert.equal(exp.monthlyReturns.length, 12);
  assert.equal(exp.status, 'Completed (Simulated)');
  assert.ok(exp.metrics.sharpeRatio > 0);
  assert.ok(exp.metrics.maxDrawdownPct <= 0);
});
