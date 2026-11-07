import { ApiClient } from './api/client';
import {
  INITIAL_ACCOUNTS,
  INITIAL_CONNECTORS,
} from '../mocks/accounts';
import { INITIAL_HOLDINGS } from '../mocks/portfolio';
import { INITIAL_TRANSACTIONS, INITIAL_JOURNAL_ENTRIES } from '../mocks/transactions';
import {
  NET_WORTH_HISTORY_12M,
  CASH_FLOW_12M,
  INITIAL_WATCHLIST,
  INITIAL_RESEARCH_REPORTS,
  ECONOMIC_CALENDAR_EVENTS,
  INITIAL_STRATEGIES,
  INITIAL_BACKTESTS,
} from '../mocks/reports';
import {
  OFINANCE_ASSISTANT_STATUS,
  INITIAL_UNIFIED_MODEL_CONFIG,
  TASK_MODE_PROFILES,
  INITIAL_TOOL_PERMISSIONS,
  INITIAL_ASSISTANT_TASK_LOGS,
} from '../mocks/assistant';
import { INITIAL_APPROVAL_TASKS, INITIAL_AUDIT_LOGS } from '../mocks/audit';
import {
  calculateWealthSummary,
  calculateCashFlowTotals,
  convertCurrency,
  formatCurrency,
  runDeterministicBacktest,
  round2,
} from '../utils/finance';
import {
  AssistantTaskMode,
  AssistantToolTimelineStep,
  AssistantTaskLog,
  CurrencyCode,
  FinancialAccount,
  PortfolioHolding,
  TransactionRecord,
  JournalEntry,
  ApprovalTask,
  BacktestExperiment,
} from '../types';

export interface AssistantRunRequestPayload {
  task_mode: AssistantTaskMode;
  user_input: string;
  prompt?: string;
  base_currency?: CurrencyCode;
  permitted_data_scope: string;
  output_format: string;
  approval_policy: string;
}

export interface AssistantDemoSnapshotContext {
  baseCurrency: CurrencyCode;
  accounts: FinancialAccount[];
  holdings: PortfolioHolding[];
  transactions: TransactionRecord[];
  journalEntries: JournalEntry[];
  approvalTasks: ApprovalTask[];
  backtests: BacktestExperiment[];
}

export interface AssistantRunResponsePayload {
  task_id: string;
  assistant: 'OFinanceAssistant';
  assistant_name: 'OFinanceAssistant';
  task_mode: AssistantTaskMode;
  execution_origin: 'DEMO_ADAPTER' | 'LOCAL_FASTAPI_GEMINI';
  timestamp: string;
  status: string;
  content: string;
  assistant_reply: string;
  duration_ms: number;
  tokens_used: number | null;
  estimated_cost_usd: number | null;
  tool_timeline: AssistantToolTimelineStep[];
  structured_metrics: { label: string; value: string; delta?: string }[];
  task_log: AssistantTaskLog;
}

export function toAssistantTaskLogDto(log: AssistantTaskLog): import('../types').AssistantTaskLogDto {
  return {
    id: log.id,
    timestamp: log.timestamp,
    assistant_name: log.assistantName,
    task_mode: log.taskMode,
    execution_origin: log.executionOrigin,
    trigger: log.trigger,
    task_summary: log.taskSummary,
    tools_invoked: log.toolsInvoked,
    duration_ms: log.durationMs,
    tokens_used: log.tokensUsed,
    estimated_cost_usd: log.estimatedCostUSD,
    status: log.status,
    output_preview: log.outputPreview,
  };
}

export function fromAssistantTaskLogDto(dto: import('../types').AssistantTaskLogDto): AssistantTaskLog {
  return {
    id: dto.id,
    timestamp: dto.timestamp,
    assistantName: dto.assistant_name,
    taskMode: dto.task_mode,
    executionOrigin: dto.execution_origin,
    trigger: dto.trigger,
    taskSummary: dto.task_summary,
    toolsInvoked: dto.tools_invoked,
    durationMs: dto.duration_ms,
    tokensUsed: dto.tokens_used,
    estimatedCostUSD: dto.estimated_cost_usd,
    status: dto.status,
    outputPreview: dto.output_preview,
  };
}

/**
 * Deterministic Demo Adapter for `POST /api/v1/assistant/run`:
 * - Used ONLY when `ApiClient.isDemoMode === true`.
 * - Dynamically computes figures from the live in-memory `accounts`, `holdings`, `transactions`,
 *   and `journalEntries` state via `src/utils/finance.ts` (never hardcoded strings).
 * - Explicitly sets `tokensUsed: null` and `estimatedCostUSD: null` so simulated runs are never
 *   disguised as real Gemini API token consumption or real model billing.
 */
export function executeDeterministicDemoAssistantRun(
  payload: AssistantRunRequestPayload,
  ctx: AssistantDemoSnapshotContext
): AssistantRunResponsePayload {
  const nowStr = '2026-11-02 ' + new Date().toTimeString().slice(0, 8) + ' UTC';
  const taskId = `TASK-${Date.now().toString().slice(-5)}`;
  const { baseCurrency, accounts, holdings, transactions, journalEntries, approvalTasks, backtests } = ctx;

  const wealth = calculateWealthSummary(accounts, holdings, baseCurrency);
  const cashFlow = calculateCashFlowTotals(transactions, baseCurrency);
  const pendingApprovalsCount = approvalTasks.filter((t) => t.status === 'Pending').length;
  const postedEntriesCount = journalEntries.filter((j) => j.status === 'Posted').length;
  const pendingDraftsCount = journalEntries.filter((j) => j.status === 'Pending Approval').length;
  const anomalyTxCount = transactions.filter((t) => t.ledgerStatus === 'Anomaly Flagged').length;

  // Compute live single-stock and sector weights from `holdings`
  const sortedHoldings = [...holdings]
    .map((h) => {
      const valInBase = convertCurrency(h.marketValue, h.currency, baseCurrency);
      const weightPct = wealth.totalInvestments > 0 ? round2((valInBase / wealth.totalInvestments) * 100) : 0;
      return { ...h, valInBase, weightPct };
    })
    .sort((a, b) => b.valInBase - a.valInBase);

  const topHolding = sortedHoldings[0];
  const techHoldings = sortedHoldings.filter((h) => h.sector.toLowerCase().includes('tech') || h.sector.toLowerCase().includes('semi'));
  const techValueBase = round2(techHoldings.reduce((acc, h) => acc + h.valInBase, 0));
  const techWeightPct = wealth.totalInvestments > 0 ? round2((techValueBase / wealth.totalInvestments) * 100) : 0;

  const nonUsdWeightPct = round2(
    wealth.currencyExposure
      .filter((c) => c.currency !== 'USD')
      .reduce((acc, c) => acc + c.weightPct, 0)
  );

  let content = '';
  let toolTimeline: AssistantToolTimelineStep[] = [];
  let structuredMetrics: { label: string; value: string; delta?: string }[] = [];

  if (payload.task_mode === 'Accounting') {
    const savingsRatePct =
      cashFlow.totalInflow > 0
        ? round2((cashFlow.netCashFlow / cashFlow.totalInflow) * 100)
        : 0;

    content = `[DEMO ADAPTER · DETERMINISTIC SIMULATION — NO LIVE GEMINI CALL] OFinanceAssistant (Accounting Mode) invoked 4 deterministic functions over ${transactions.length} transactions and ${journalEntries.length} Beancount entries in ${baseCurrency}:`;
    toolTimeline = [
      {
        stepNumber: 1,
        toolName: 'Read Transactions',
        category: 'Read-Only',
        callSignature: `read_transactions(total_records=${transactions.length}, base_currency="${baseCurrency}")`,
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `Loaded ${transactions.length} normalized transactions across ${accounts.length} accounts; identified ${cashFlow.transferPairCount} linked internal transfer pairs.`,
        durationMs: 95,
      },
      {
        stepNumber: 2,
        toolName: 'Calculate Cash Flow',
        category: 'Deterministic Computation',
        callSignature: `calculateCashFlowTotals(transactions, baseCurrency="${baseCurrency}")`,
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `Confirmed Posted Inflow = ${formatCurrency(cashFlow.totalInflow, baseCurrency)}; Confirmed Posted Outflow = ${formatCurrency(cashFlow.totalOutflow, baseCurrency)}; Net Cash Flow = ${formatCurrency(cashFlow.netCashFlow, baseCurrency, { showSign: true })} (${savingsRatePct}% net retention). Excluded ${formatCurrency(cashFlow.excludedTransferVolume, baseCurrency)} internal transfers.`,
        durationMs: 140,
      },
      {
        stepNumber: 3,
        toolName: 'Verify Double-Entry Balance',
        category: 'Deterministic Computation',
        callSignature: `verify_double_entry_balance(posted_entries=${postedEntriesCount})`,
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `Verified ${postedEntriesCount} posted Beancount entries sum to 0.00 ${baseCurrency} residual; ${pendingDraftsCount} low-confidence drafts remain gated for human approval.`,
        durationMs: 115,
      },
      {
        stepNumber: 4,
        toolName: 'Generate Journal Draft',
        category: 'Drafting',
        callSignature: `generate_journal_draft(output_schema="${payload.output_format}")`,
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `Prepared AccountingDraftResult summary (${pendingDraftsCount} unposted drafts awaiting operator sign-off).`,
        durationMs: 130,
      },
    ];
    structuredMetrics = [
      { label: `Confirmed Inflow (${baseCurrency})`, value: formatCurrency(cashFlow.totalInflow, baseCurrency), delta: 'Settled + Posted' },
      { label: `Confirmed Outflow (${baseCurrency})`, value: formatCurrency(cashFlow.totalOutflow, baseCurrency), delta: `Pending: ${formatCurrency(cashFlow.pendingOutflow, baseCurrency)}` },
      { label: `Net Settled Cash Flow`, value: formatCurrency(cashFlow.netCashFlow, baseCurrency, { showSign: true }), delta: `${savingsRatePct}% Retention` },
      { label: 'Excluded Internal Transfers', value: formatCurrency(cashFlow.excludedTransferVolume, baseCurrency), delta: `${cashFlow.transferPairCount} Matched Pairs` },
    ];
  } else if (payload.task_mode === 'Audit') {
    content = `[DEMO ADAPTER · DETERMINISTIC SIMULATION — NO LIVE GEMINI CALL] OFinanceAssistant (Audit Mode) audited ${transactions.length} transactions and ${journalEntries.length} Beancount entries for unmatched items and trial balance conservation:`;
    toolTimeline = [
      {
        stepNumber: 1,
        toolName: 'Read Transactions',
        category: 'Read-Only',
        callSignature: 'read_transactions(filter=["Pending Approval", "Anomaly Flagged"])',
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `Found ${pendingDraftsCount} Pending Approval drafts (${formatCurrency(cashFlow.pendingOutflow, baseCurrency)} pending outflow) and ${anomalyTxCount} Anomaly Flagged transaction(s).`,
        durationMs: 100,
      },
      {
        stepNumber: 2,
        toolName: 'Read Beancount Ledger',
        category: 'Read-Only',
        callSignature: 'read_beancount_ledger(path="~/o-finance/ledger/main.beancount")',
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `Inspected ${journalEntries.length} journal entries (${postedEntriesCount} Posted, ${pendingDraftsCount} Pending Approval).`,
        durationMs: 110,
      },
      {
        stepNumber: 3,
        toolName: 'Verify Double-Entry Balance',
        category: 'Deterministic Computation',
        callSignature: 'verify_double_entry_balance(strict_zero_residual=True)',
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `All ${postedEntriesCount} Posted (*) Beancount entries balance to 0.00 ${baseCurrency} residual.`,
        durationMs: 125,
      },
      {
        stepNumber: 4,
        toolName: 'Request Human Approval',
        category: 'Governance',
        callSignature: `request_human_approval(pending_tasks=${pendingApprovalsCount})`,
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `${pendingApprovalsCount} governance tasks remain queued in the Approval Inbox.`,
        durationMs: 90,
      },
    ];
    structuredMetrics = [
      { label: 'Posted Journal Entries', value: `${postedEntriesCount} / ${journalEntries.length}`, delta: '0.00 Residual' },
      { label: 'Pending Drafts Volume', value: formatCurrency(cashFlow.pendingOutflow, baseCurrency), delta: `${pendingDraftsCount} Drafts` },
      { label: 'Anomaly Flagged Tx', value: `${anomalyTxCount} Item(s)`, delta: 'Approval Inbox' },
      { label: 'Matched Transfer Pairs', value: `${cashFlow.transferPairCount} Pairs`, delta: formatCurrency(cashFlow.excludedTransferVolume, baseCurrency) },
    ];
  } else if (payload.task_mode === 'Portfolio Analysis') {
    content = `[DEMO ADAPTER · DETERMINISTIC SIMULATION — NO LIVE GEMINI CALL] OFinanceAssistant (Portfolio Analysis Mode) aggregated ${holdings.length} positions across ${accounts.length} accounts in ${baseCurrency}:`;
    toolTimeline = [
      {
        stepNumber: 1,
        toolName: 'Read Holdings',
        category: 'Read-Only',
        callSignature: `read_holdings(count=${holdings.length}, base_currency="${baseCurrency}")`,
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `Aggregated ${holdings.length} positions totaling ${formatCurrency(wealth.totalInvestments, baseCurrency)} across 4 brokerage accounts.`,
        durationMs: 110,
      },
      {
        stepNumber: 2,
        toolName: 'Calculate FX',
        category: 'Deterministic Computation',
        callSignature: `calculate_fx(base="${baseCurrency}")`,
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `Currency breakdown: ${wealth.currencyExposure.map((c) => `${c.currency} ${c.weightPct}%`).join(', ')} (Non-USD exposure: ${nonUsdWeightPct}%).`,
        durationMs: 90,
      },
      {
        stepNumber: 3,
        toolName: 'Calculate Portfolio Returns',
        category: 'Deterministic Computation',
        callSignature: `calculateWealthSummary(accounts, holdings, "${baseCurrency}")`,
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `Total Net Worth = ${formatCurrency(wealth.totalNetWorth, baseCurrency)}; Overall Portfolio Return = ${formatCurrency(wealth.overallReturn, baseCurrency, { showSign: true })} (${wealth.overallReturnPct}%).`,
        durationMs: 145,
      },
      {
        stepNumber: 4,
        toolName: 'Generate Investment Analysis',
        category: 'Drafting',
        callSignature: `generate_investment_analysis(output_schema="${payload.output_format}")`,
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `Top holding ${topHolding.symbol} stands at ${formatCurrency(topHolding.valInBase, baseCurrency)} (${topHolding.weightPct}% of investments).`,
        durationMs: 135,
      },
    ];
    structuredMetrics = [
      { label: `Total Investments (${baseCurrency})`, value: formatCurrency(wealth.totalInvestments, baseCurrency), delta: `${holdings.length} Holdings` },
      { label: `Overall Total Return`, value: formatCurrency(wealth.overallReturn, baseCurrency, { showSign: true }), delta: `${wealth.overallReturnPct}% Return` },
      { label: `Total Cash Reserves`, value: formatCurrency(wealth.totalCash, baseCurrency), delta: 'Multi-Currency' },
      { label: 'Non-USD FX Exposure', value: `${nonUsdWeightPct}%`, delta: 'GBP, EUR & CNY' },
    ];
  } else if (payload.task_mode === 'Quantitative Research') {
    const latestBt = backtests[0];
    content = `[DEMO ADAPTER · DETERMINISTIC SIMULATION — NO LIVE GEMINI CALL] OFinanceAssistant (Quantitative Research Mode) inspected the deterministic DuckDB backtest registry (${backtests.length} experiments):`;
    toolTimeline = [
      {
        stepNumber: 1,
        toolName: 'Read Market Data',
        category: 'Read-Only',
        callSignature: `read_market_data(symbol="${latestBt.symbol}", benchmark="${latestBt.benchmark}")`,
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `Loaded 12-month simulated OHLCV series for ${latestBt.symbol} vs ${latestBt.benchmark}.`,
        durationMs: 95,
      },
      {
        stepNumber: 2,
        toolName: 'Run DuckDB Backtest',
        category: 'Deterministic Computation',
        callSignature: `runDeterministicBacktest(strategy="${latestBt.strategyId}", comm=${latestBt.commissionBps}bps, slip=${latestBt.slippageBps}bps)`,
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `Experiment ${latestBt.id} (${latestBt.strategyName}) produced +${latestBt.metrics.totalReturnPct}% total return vs +${latestBt.metrics.benchmarkReturnPct}% benchmark.`,
        durationMs: 210,
      },
      {
        stepNumber: 3,
        toolName: 'Calculate Risk Metrics',
        category: 'Deterministic Computation',
        callSignature: `calculate_risk_metrics(experiment_id="${latestBt.id}")`,
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `Sharpe = ${latestBt.metrics.sharpeRatio}, Sortino = ${latestBt.metrics.sortinoRatio}, Max Drawdown = ${latestBt.metrics.maxDrawdownPct}%, Win Rate = ${latestBt.metrics.winRatePct}%.`,
        durationMs: 115,
      },
    ];
    structuredMetrics = [
      { label: `Latest Run (${latestBt.symbol})`, value: `+${latestBt.metrics.totalReturnPct}%`, delta: `vs +${latestBt.metrics.benchmarkReturnPct}% Bench` },
      { label: 'Sharpe / Sortino', value: `${latestBt.metrics.sharpeRatio} / ${latestBt.metrics.sortinoRatio}`, delta: `${latestBt.commissionBps + latestBt.slippageBps}bps Cost` },
      { label: 'Max Drawdown', value: `${latestBt.metrics.maxDrawdownPct}%`, delta: '1.0x Unlevered' },
      { label: 'Registered Experiments', value: `${backtests.length} Runs`, delta: 'DuckDB Sim' },
    ];
  } else if (payload.task_mode === 'Research') {
    content = `[DEMO ADAPTER · DETERMINISTIC SIMULATION — NO LIVE GEMINI CALL] OFinanceAssistant (Research Mode) evaluated tech/semiconductor holdings exposure and verified the external Daily Analysis Connector status:`;
    toolTimeline = [
      {
        stepNumber: 1,
        toolName: 'Read Holdings',
        category: 'Read-Only',
        callSignature: 'read_holdings(sector="Information Technology & Semiconductors")',
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `Aggregated ${techHoldings.length} technology/semiconductor positions (${techHoldings.map((h) => h.symbol).join(', ')}) totaling ${formatCurrency(techValueBase, baseCurrency)} (${techWeightPct}% of portfolio).`,
        durationMs: 105,
      },
      {
        stepNumber: 2,
        toolName: 'Read External Research Reports',
        category: 'Read-Only',
        callSignature: 'read_external_research_reports(connector="daily_stock_analysis")',
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `External daily_stock_analysis connector is Not Connected (Read-Only boundary enforced). Loaded ${INITIAL_RESEARCH_REPORTS.length} local demo research briefings.`,
        durationMs: 110,
      },
      {
        stepNumber: 3,
        toolName: 'Generate Research Report',
        category: 'Drafting',
        callSignature: `generate_research_report(output_schema="${payload.output_format}")`,
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: 'Prepared ResearchBriefingResult linking portfolio concentration to semiconductor CapEx notes.',
        durationMs: 160,
      },
    ];
    structuredMetrics = [
      { label: `Tech & Semi Exposure`, value: formatCurrency(techValueBase, baseCurrency), delta: `${techWeightPct}% Weight` },
      { label: 'Local Demo Briefings', value: `${INITIAL_RESEARCH_REPORTS.length} Reports`, delta: 'REP-2026-101..104' },
      { label: 'External Connector', value: 'Not Connected', delta: 'Read-Only API' },
      { label: 'Real LLM Spend', value: '$0.00 USD', delta: 'Demo Adapter (0 Tok)' },
    ];
  } else {
    // Risk Analysis Mode (Default)
    const liquidityRatioPct =
      wealth.totalNetWorth > 0 ? round2((wealth.totalCash / wealth.totalNetWorth) * 100) : 0;

    content = `[DEMO ADAPTER · DETERMINISTIC SIMULATION — NO LIVE GEMINI CALL] OFinanceAssistant (Risk Analysis Mode) computed concentration, liquidity, and ledger balance metrics over your ${baseCurrency} Demo dataset:`;
    toolTimeline = [
      {
        stepNumber: 1,
        toolName: 'Read Holdings',
        category: 'Read-Only',
        callSignature: `read_holdings(total_positions=${holdings.length}, base_currency="${baseCurrency}")`,
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `Loaded ${holdings.length} active positions totaling ${formatCurrency(wealth.totalInvestments, baseCurrency)} and ${formatCurrency(wealth.totalCash, baseCurrency)} cash reserves.`,
        durationMs: 105,
      },
      {
        stepNumber: 2,
        toolName: 'Calculate Risk Metrics',
        category: 'Deterministic Computation',
        callSignature: 'calculate_risk_metrics(max_single_weight=12.0, max_sector_weight=40.0)',
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `Top position ${topHolding.symbol} is ${formatCurrency(topHolding.valInBase, baseCurrency)} (${topHolding.weightPct}% vs 12.0% cap). Tech/Semi sector weight is ${techWeightPct}% (vs 40.0% ceiling).`,
        durationMs: 155,
      },
      {
        stepNumber: 3,
        toolName: 'Verify Double-Entry Balance',
        category: 'Deterministic Computation',
        callSignature: 'verify_double_entry_balance(check_transfer_pairs=True)',
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `${cashFlow.transferPairCount} internal transfer pairs (${formatCurrency(cashFlow.excludedTransferVolume, baseCurrency)}) verified with 0.00 ${baseCurrency} trial balance residual.`,
        durationMs: 120,
      },
      {
        stepNumber: 4,
        toolName: 'Record Audit Event',
        category: 'Governance',
        callSignature: 'record_audit_event(actor="OFinanceAssistant", origin="DEMO_ADAPTER")',
        status: 'Completed (Demo Deterministic)',
        deterministicFinding: `Recorded deterministic risk check; ${pendingApprovalsCount} tasks remain in Approval Inbox.`,
        durationMs: 85,
      },
    ];
    structuredMetrics = [
      { label: `Total Net Worth (${baseCurrency})`, value: formatCurrency(wealth.totalNetWorth, baseCurrency), delta: `Cash ${liquidityRatioPct}%` },
      { label: `Top Position (${topHolding.symbol})`, value: `${topHolding.weightPct}%`, delta: topHolding.weightPct > 12 ? `+${round2(topHolding.weightPct - 12)}% over cap` : 'Within Cap' },
      { label: 'Tech & Semi Sector', value: `${techWeightPct}%`, delta: techWeightPct > 40 ? `+${round2(techWeightPct - 40)}% over cap` : 'Within Cap' },
      { label: 'Real Token / Cost', value: '0 tok / $0.00', delta: 'Demo Simulation' },
    ];
  }

  const totalDurationMs = toolTimeline.reduce((acc, s) => acc + s.durationMs, 0);

  const taskLog: AssistantTaskLog = {
    id: taskId,
    timestamp: nowStr,
    assistantName: 'OFinanceAssistant',
    taskMode: payload.task_mode,
    executionOrigin: 'DEMO_ADAPTER',
    trigger: 'User Prompt',
    taskSummary: `[Demo Adapter] ${payload.task_mode}: "${payload.user_input.slice(0, 56)}"`,
    toolsInvoked: toolTimeline.map((s) => s.toolName),
    durationMs: totalDurationMs,
    tokensUsed: null,
    estimatedCostUSD: null,
    status: 'Success (Demo Adapter)',
    outputPreview: content.slice(0, 115) + '...',
  };

  return {
    task_id: taskId,
    assistant: 'OFinanceAssistant',
    assistant_name: 'OFinanceAssistant',
    task_mode: payload.task_mode,
    execution_origin: 'DEMO_ADAPTER',
    timestamp: nowStr,
    status: 'Success (Demo Adapter)',
    content,
    assistant_reply: content,
    duration_ms: totalDurationMs,
    tokens_used: null,
    estimated_cost_usd: null,
    tool_timeline: toolTimeline,
    structured_metrics: structuredMetrics,
    task_log: taskLog,
  };
}

/**
 * 10 Modular Domain Services (O-Finance v0.3.1 Architecture):
 * 1. AccountService
 * 2. TransactionService
 * 3. LedgerService
 * 4. PortfolioService
 * 5. MarketDataService
 * 6. ResearchService
 * 7. AssistantService (Dual-Mode: Demo Deterministic Adapter vs Local FastAPI Gemini Runtime)
 * 8. ApprovalService
 * 9. AuditService
 * 10. SyncService
 */

export const AccountService = {
  getAccounts: () => ApiClient.request('/api/v1/accounts', () => INITIAL_ACCOUNTS),
  getConnectors: () => ApiClient.request('/api/v1/connectors', () => INITIAL_CONNECTORS),
};

export const TransactionService = {
  getTransactions: () => ApiClient.request('/api/v1/transactions', () => INITIAL_TRANSACTIONS),
};

export const LedgerService = {
  getJournalEntries: () => ApiClient.request('/api/v1/ledger/entries', () => INITIAL_JOURNAL_ENTRIES),
  getFavaStatus: () =>
    ApiClient.request('/api/v1/ledger/status', () => ({
      serviceStatus: 'Placeholder Integration (Local Fava Not Running)',
      favaUrl: 'http://127.0.0.1:5000',
      ledgerFilePath: '~/o-finance/ledger/main.beancount (Simulated Path)',
      lastValidated: '2026-11-02 14:16:05 UTC',
      isBalanced: true,
    })),
  importCsvStatement: (rows: Array<Record<string, any>> | string) =>
    ApiClient.request('/api/v1/ledger/import-csv', () => ({
      success: true,
      total_rows: Array.isArray(rows) ? rows.length : 1,
      directly_posted: Array.isArray(rows) ? rows.length : 1,
      pending_approval: 0,
    }), {
      method: 'POST',
      body: typeof rows === 'string' ? rows : JSON.stringify({ rows }),
    }),
  postApprovedEntry: (payload: {
    approval_task_id: string;
    beancount_file_path?: string;
  }) =>
    ApiClient.request('/api/v1/ledger/post-approved', () => ({
      success: true,
      message: 'Approved entry appended to Beancount file',
      task_id: payload.approval_task_id,
    }), {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const PortfolioService = {
  getHoldings: () => ApiClient.request('/api/v1/portfolio/holdings', () => INITIAL_HOLDINGS),
  getNetWorthHistory: () => ApiClient.request('/api/v1/portfolio/history', () => NET_WORTH_HISTORY_12M),
  getCashFlowHistory: () => ApiClient.request('/api/v1/portfolio/cashflow', () => CASH_FLOW_12M),
};

export const MarketDataService = {
  getWatchlist: () => ApiClient.request('/api/v1/market/watchlist', () => INITIAL_WATCHLIST),
  getEconomicCalendar: () => ApiClient.request('/api/v1/market/calendar', () => ECONOMIC_CALENDAR_EVENTS),
};

export const ResearchService = {
  getReports: () => ApiClient.request('/api/v1/market-intelligence/reports', () => INITIAL_RESEARCH_REPORTS),
  getStrategies: () => ApiClient.request('/api/v1/quant/strategies', () => INITIAL_STRATEGIES),
  getBacktests: () => ApiClient.request('/api/v1/quant/backtests', () => INITIAL_BACKTESTS),
  executeBacktest: (params: Parameters<typeof runDeterministicBacktest>[0]) =>
    ApiClient.request('/api/v1/quant/backtest', () => runDeterministicBacktest(params), {
      method: 'POST',
      body: JSON.stringify({
        strategy_id: params.strategyId,
        symbols: params.symbol ? [params.symbol] : ['AAPL'],
        start_date: params.startDate || '2025-01-01',
        end_date: params.endDate || '2025-12-31',
        initial_capital: params.initialCapital ?? 100000.0,
        commission_bps: params.commissionBps ?? 5.0,
        slippage_bps: params.slippageBps ?? 2.0,
      }),
    }),
  getDailyAnalysisConnectorStatus: () =>
    ApiClient.request('/api/v1/market-intelligence/connector-status', () => ({
      serviceName: 'Daily Analysis Connector (daily_stock_analysis)',
      apiBaseUrl: 'http://127.0.0.1:8090/api/v1/reports',
      connectionStatus: 'Not Connected',
      lastReportSync: 'Never (Placeholder Interface Only)',
      latestReportDate: 'N/A — External Service Independent',
      boundaryPolicy: 'Read-Only External API · Zero Code/DB Merge',
    })),
};

export const AssistantService = {
  getStatus: () =>
    ApiClient.request('/api/v1/assistant/status', () => ({
      ...OFINANCE_ASSISTANT_STATUS,
      supportedTaskModes: TASK_MODE_PROFILES.map((p) => p.mode),
    })),
  getConfig: () => ApiClient.request('/api/v1/assistant/config', () => INITIAL_UNIFIED_MODEL_CONFIG),
  updateConfig: (payload: { provider?: string; base_url?: string; model_name?: string; api_key?: string }) =>
    ApiClient.request('/api/v1/assistant/config', () => ({
      ...INITIAL_UNIFIED_MODEL_CONFIG,
      provider: payload.provider || INITIAL_UNIFIED_MODEL_CONFIG.provider,
      base_url: payload.base_url || INITIAL_UNIFIED_MODEL_CONFIG.base_url,
      model: payload.model_name || INITIAL_UNIFIED_MODEL_CONFIG.model,
    }), {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  probeConnection: (payload: { provider?: string; base_url?: string; model_name?: string; api_key?: string }) =>
    ApiClient.request('/api/v1/assistant/probe', () => ({
      reachable: true,
      latency_ms: 124.5,
      provider: payload.provider || 'openai_compatible',
      base_url: payload.base_url || 'https://api.openai.com/v1',
      model: payload.model_name || 'gpt-4o',
      message: 'Demo Fallback: Endpoint responsive (Simulated probe)',
    }), {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  runTask: (payload: AssistantRunRequestPayload, demoContext: AssistantDemoSnapshotContext) =>
    ApiClient.request<AssistantRunResponsePayload>(
      '/api/v1/assistant/run',
      () => executeDeterministicDemoAssistantRun(payload, demoContext),
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),
  getTasks: () => ApiClient.request('/api/v1/assistant/tasks', () => INITIAL_ASSISTANT_TASK_LOGS),
  getTaskById: (taskId: string) =>
    ApiClient.request(`/api/v1/assistant/tasks/${taskId}`, () =>
      INITIAL_ASSISTANT_TASK_LOGS.find((t) => t.id === taskId) || INITIAL_ASSISTANT_TASK_LOGS[0]
    ),
  getTools: () => ApiClient.request('/api/v1/assistant/tools', () => INITIAL_TOOL_PERMISSIONS),
  getUsage: () =>
    ApiClient.request('/api/v1/assistant/usage', () => ({
      assistant: 'OFinanceAssistant' as const,
      executionOrigin: 'DEMO_ADAPTER' as const,
      realTokensUsedToday: OFINANCE_ASSISTANT_STATUS.realTokensUsedToday,
      realBudgetUsedTodayUSD: OFINANCE_ASSISTANT_STATUS.realBudgetUsedTodayUSD,
      simulatedTasksExecutedToday: OFINANCE_ASSISTANT_STATUS.simulatedTasksExecutedToday,
      dailyBudgetUSD: INITIAL_UNIFIED_MODEL_CONFIG.daily_budget_usd,
      perTaskBudgetUSD: INITIAL_UNIFIED_MODEL_CONFIG.per_task_budget_usd,
    })),
};

export const ApprovalService = {
  getTasks: () => ApiClient.request('/api/v1/approvals', () => INITIAL_APPROVAL_TASKS),
  approveTask: (taskId: string, payload?: Record<string, any>) =>
    ApiClient.request(`/api/v1/approvals/${taskId}/approve`, () => ({
      success: true,
      task_id: taskId,
      status: 'Approved',
    }), {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),
  rejectTask: (taskId: string, payload?: Record<string, any>) =>
    ApiClient.request(`/api/v1/approvals/${taskId}/reject`, () => ({
      success: true,
      task_id: taskId,
      status: 'Rejected',
    }), {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),
};

export const AuditService = {
  getLogs: () => ApiClient.request('/api/v1/audit/logs', () => INITIAL_AUDIT_LOGS),
};

export const BrokerageService = {
  getStatus: () =>
    ApiClient.request('/api/v1/brokerage/status', () => ({
      gateway_status: 'STOPPED',
      port: 5055,
      session_authenticated: false,
      schwab_oauth_status: 'UNCONFIGURED',
      ibkr_config: {
        gateway_url: 'https://127.0.0.1:5055',
        flex_token_masked: '****',
        flex_query_id: '',
        account_id: 'U12345678',
      },
      schwab_config: {
        app_key_masked: '****',
        app_secret_masked: '****',
        callback_url: 'http://127.0.0.1:8000/api/v1/brokerage/schwab/callback',
        account_id: 'SCHW-998877',
      },
      console_logs: [],
    })),
  controlGateway: (action: string) =>
    ApiClient.request('/api/v1/brokerage/gateway/control', () => ({
      status: 'pending',
      message: `Gateway ${action} command sent`,
    }), {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  saveConfig: (payload: { ibkr?: Record<string, string>; schwab?: Record<string, string> }) =>
    ApiClient.request('/api/v1/brokerage/config', () => ({
      gateway_status: 'STOPPED',
      port: 5055,
      session_authenticated: false,
      schwab_oauth_status: 'CONFIGURED',
      ibkr_config: {
        gateway_url: 'https://127.0.0.1:5055',
        flex_token_masked: 'flx-...1234',
        flex_query_id: '123456',
        account_id: 'U12345678',
      },
      schwab_config: {
        app_key_masked: 'schw-...5678',
        app_secret_masked: '****',
        callback_url: 'http://127.0.0.1:8000/api/v1/brokerage/schwab/callback',
        account_id: 'SCHW-998877',
      },
      console_logs: ['Config saved.'],
    }), {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getAuthUrl: () =>
    ApiClient.request('/api/v1/brokerage/schwab/auth-url', () => ({
      auth_url: 'https://auth.schwab.com/v1/oauth/authorize?response_type=code&client_id=DEMO_SCHWAB_APP_KEY&redirect_uri=http%3A%2F%2F127.0.0.1%3A8000%2Fapi%2Fv1%2Fbrokerage%2Fschwab%2Fcallback',
    })),
  stageOrder: (payload: {
    broker: string;
    account_id: string;
    symbol: string;
    side: string;
    quantity: number;
    order_type?: string;
    limit_price?: number;
    dry_run?: boolean;
  }) =>
    ApiClient.request('/api/v1/brokerage/orders/stage', () => ({
      status: 'PENDING',
      approval_id: `appr-${Date.now().toString().slice(-6)}`,
      task_mode: 'portfolio_analysis',
      action: 'EXECUTE_BROKERAGE_ORDER',
      target: `brokerage:${payload.broker}:${payload.symbol}`,
      order_payload: payload,
      message: 'Order intent draft staged to Approval Inbox.',
    }), {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  executeApprovedOrder: (payload: { approval_id: string; order_payload: Record<string, any> }) =>
    ApiClient.request('/api/v1/brokerage/orders/execute-approved', () => ({
      status: 'EXECUTED',
      approval_id: payload.approval_id,
      audit_id: `aud-${Date.now().toString().slice(-6)}`,
      audit_hash: 'a1b2c3d4e5f6',
      executed_trade: payload.order_payload,
      beancount_file: 'ledger/main.beancount',
    }), {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const SyncService = {
  triggerSimulatedSync: (targetInstitution?: string) =>
    ApiClient.request('/api/v1/sync/trigger', () => ({
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      status: 'Simulated Sync Completed — No Real Financial Institution Connected',
      target: targetInstitution || 'All Demo Accounts',
    })),
};
