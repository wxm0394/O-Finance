import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertCurrency,
  calculateWealthSummary,
  calculateCashFlowTotals,
  runDeterministicBacktest,
  calculateTrialBalance,
  formatCurrency,
  SIMULATED_FX_RATES_TO_USD,
} from './finance';
import { FinancialAccount, PortfolioHolding, TransactionRecord, JournalEntry } from '../types';

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
    {
      id: 'tx-5',
      date: '2026-10-31',
      institution: 'US Bank',
      accountId: 'acc-us',
      accountName: 'US Checking',
      description: 'Pending Wire Outflow',
      payee: 'Cloud Infra Corp',
      fees: 0,
      amount: -1480,
      currency: 'USD',
      type: 'Fee',
      category: 'Expenses:Cloud',
      direction: 'Outflow',
      status: 'Pending',
      ledgerStatus: 'Pending Approval',
      rawSourceJson: '{}',
      dataSource: 'Plaid Mock',
    },
  ];

  const flow = calculateCashFlowTotals(txs, 'USD');
  assert.equal(flow.totalInflow, 8500);
  assert.equal(flow.totalOutflow, 2500);
  assert.equal(flow.netCashFlow, 6000);
  assert.equal(flow.pendingOutflow, 1480);
  assert.equal(flow.pendingInflow, 0);
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

test('CNY deterministic FX conversions: bidirectional accuracy across USD, GBP, EUR, and identity', () => {
  // 1. CNY -> USD: 1000 CNY * 0.14 / 1.0 = 140.0 USD
  const usdFromCny = convertCurrency(1000, 'CNY', 'USD', SIMULATED_FX_RATES_TO_USD);
  assert.equal(usdFromCny, 140.0);

  // 2. USD -> CNY: 140 USD * 1.0 / 0.14 = 1000.0 CNY
  const cnyFromUsd = convertCurrency(140, 'USD', 'CNY', SIMULATED_FX_RATES_TO_USD);
  assert.equal(cnyFromUsd, 1000.0);

  // 3. CNY -> GBP: 1000 CNY * 0.14 / 1.285 ≈ 108.95 GBP
  const gbpFromCny = convertCurrency(1000, 'CNY', 'GBP', SIMULATED_FX_RATES_TO_USD);
  assert.equal(gbpFromCny, 108.95);

  // 4. GBP -> CNY: 100 GBP * 1.285 / 0.14 ≈ 917.86 CNY
  const cnyFromGbp = convertCurrency(100, 'GBP', 'CNY', SIMULATED_FX_RATES_TO_USD);
  assert.equal(cnyFromGbp, 917.86);

  // 5. CNY -> EUR: 1000 CNY * 0.14 / 1.092 ≈ 128.21 EUR
  const eurFromCny = convertCurrency(1000, 'CNY', 'EUR', SIMULATED_FX_RATES_TO_USD);
  assert.equal(eurFromCny, 128.21);

  // 6. EUR -> CNY: 100 EUR * 1.092 / 0.14 = 780.0 CNY
  const cnyFromEur = convertCurrency(100, 'EUR', 'CNY', SIMULATED_FX_RATES_TO_USD);
  assert.equal(cnyFromEur, 780.0);

  // 7. Identity conversion: CNY -> CNY
  const cnyIdentity = convertCurrency(8888.88, 'CNY', 'CNY', SIMULATED_FX_RATES_TO_USD);
  assert.equal(cnyIdentity, 8888.88);
});

test('CNY currency formatting renders ¥ symbol and compact notations correctly', () => {
  assert.equal(formatCurrency(125000, 'CNY'), '¥125,000.00');
  assert.equal(formatCurrency(-3500.5, 'CNY'), '-¥3,500.50');
  assert.equal(formatCurrency(88.8, 'CNY', { showSign: true }), '+¥88.80');
  assert.equal(formatCurrency(1250000, 'CNY', { compact: true }), '¥1.25M');
  assert.equal(formatCurrency(50000, 'CNY', { compact: true }), '¥50.0K');
});

test('calculateWealthSummary with CNY accounts and switching base currency to CNY', () => {
  const accounts: FinancialAccount[] = [
    {
      id: 'acc-usd',
      institution: 'US Bank',
      accountName: 'US Checking',
      accountNumberMasked: '****1111',
      accountType: 'Checking',
      currency: 'USD',
      currentBalance: 10000,
      availableCash: 10000,
      investmentValue: 0,
      liabilityAmount: 0,
      lastSync: '2026-11-02',
      connectionStatus: 'Demo Only',
      dataFreshness: 'Simulated Live',
      region: 'US',
      connectorId: 'conn-us',
    },
    {
      id: 'acc-cny',
      institution: 'Bank of China',
      accountName: 'BOC Liquidity',
      accountNumberMasked: '****8888',
      accountType: 'Checking',
      currency: 'CNY',
      currentBalance: 70000,
      availableCash: 70000, // 70000 * 0.14 = 9,800 USD
      investmentValue: 0,
      liabilityAmount: 0,
      lastSync: '2026-11-02',
      connectionStatus: 'Demo Only',
      dataFreshness: 'Simulated Live',
      region: 'Global',
      connectorId: 'conn-boc',
    },
  ];

  const holdings: PortfolioHolding[] = [];

  // In USD base currency:
  // totalCash = 10,000 USD + 70,000 * 0.14 USD = 10,000 + 9,800 = 19,800 USD
  const summaryInUsd = calculateWealthSummary(accounts, holdings, 'USD');
  assert.equal(summaryInUsd.totalCash, 19800);
  assert.equal(summaryInUsd.totalNetWorth, 19800);
  assert.equal(summaryInUsd.currencyExposure.length, 4);

  const cnyExposureInUsd = summaryInUsd.currencyExposure.find((c) => c.currency === 'CNY');
  assert.ok(cnyExposureInUsd);
  assert.equal(cnyExposureInUsd.amountInBase, 9800);
  assert.equal(cnyExposureInUsd.weightPct, 49.49); // 9800 / 19800 ≈ 49.49%

  // In CNY base currency:
  // 10,000 USD converted to CNY = 10000 / 0.14 ≈ 71,428.57 CNY
  // 70,000 CNY converted to CNY = 70,000 CNY
  // Total in CNY = 141,428.57 CNY
  const summaryInCny = calculateWealthSummary(accounts, holdings, 'CNY');
  assert.equal(summaryInCny.baseCurrency, 'CNY');
  assert.equal(summaryInCny.totalCash, 141428.57);
  assert.equal(summaryInCny.totalNetWorth, 141428.57);

  const cnyExposureInCny = summaryInCny.currencyExposure.find((c) => c.currency === 'CNY');
  assert.ok(cnyExposureInCny);
  assert.equal(cnyExposureInCny.amountInBase, 70000);
});

test('calculateCashFlowTotals with CNY transactions', () => {
  const txs: TransactionRecord[] = [
    {
      id: 'tx-cny-inflow',
      date: '2026-10-20',
      institution: 'Bank of China',
      accountId: 'acc-cny',
      accountName: 'BOC Liquidity',
      description: 'Consulting Income',
      payee: 'Client Co',
      fees: 0,
      amount: 20000, // 20000 * 0.14 = 2,800 USD
      currency: 'CNY',
      type: 'Deposit',
      category: 'Income:Consulting',
      direction: 'Inflow',
      status: 'Settled',
      ledgerStatus: 'Posted',
      rawSourceJson: '{}',
      dataSource: 'BOC Mock',
    },
    {
      id: 'tx-cny-outflow',
      date: '2026-10-22',
      institution: 'Bank of China',
      accountId: 'acc-cny',
      accountName: 'BOC Liquidity',
      description: 'Server Rent',
      payee: 'Tencent Cloud',
      fees: 0,
      amount: -5000, // 5000 * 0.14 = 700 USD
      currency: 'CNY',
      type: 'Withdrawal',
      category: 'Expenses:Hosting',
      direction: 'Outflow',
      status: 'Settled',
      ledgerStatus: 'Posted',
      rawSourceJson: '{}',
      dataSource: 'BOC Mock',
    },
  ];

  // Evaluated in USD base currency
  const flowUsd = calculateCashFlowTotals(txs, 'USD');
  assert.equal(flowUsd.totalInflow, 2800);
  assert.equal(flowUsd.totalOutflow, 700);
  assert.equal(flowUsd.netCashFlow, 2100);

  // Evaluated in CNY base currency
  const flowCny = calculateCashFlowTotals(txs, 'CNY');
  assert.equal(flowCny.totalInflow, 20000);
  assert.equal(flowCny.totalOutflow, 5000);
  assert.equal(flowCny.netCashFlow, 15000);
});

test('calculateTrialBalance verifies double-entry conservation on CNY journal entries', () => {
  const cnyEntries: JournalEntry[] = [
    {
      id: 'JE-CNY-001',
      date: '2026-10-25',
      flag: '*',
      payee: 'Alibaba Cloud',
      narration: 'GPU Compute Cluster',
      status: 'Posted',
      confidence: 1.0,
      sourceDocument: 'boc-invoice.json',
      postings: [
        { account: 'Expenses:Compute:AI', amount: 8000, currency: 'CNY' },
        { account: 'Assets:Banks:Checking:BOC', amount: -8000, currency: 'CNY' },
      ],
      rawBeancount: '',
    },
  ];

  const tb = calculateTrialBalance(cnyEntries, { baseCurrency: 'CNY' });
  assert.equal(tb.unbalancedEntryIds.length, 0);
  assert.equal(tb.isBalancedOverall, true);
  assert.equal(tb.totalDebitsInBase, 8000);
  assert.equal(tb.totalCreditsInBase, 8000);
  assert.equal(tb.residualInBase, 0);

  const cnySummary = tb.currencySummaries.find((s) => s.currency === 'CNY');
  assert.ok(cnySummary);
  assert.equal(cnySummary.isBalanced, true);
  assert.equal(cnySummary.totalDebits, 8000);
  assert.equal(cnySummary.totalCredits, 8000);
  assert.equal(cnySummary.residual, 0);
});
