import {
  TaskModeProfile,
  UnifiedModelConfig,
  ModelProviderPreset,
  AssistantToolPermission,
  AssistantTaskLog,
  PlaygroundMessage,
} from '../types';

export const OFINANCE_ASSISTANT_STATUS = {
  assistantName: 'OFinanceAssistant' as const,
  architecture: 'Single-Assistant Pydantic AI Design (Demo Adapter Active · FastAPI Harness Pending)',
  runtimeMode: 'DEMO_ADAPTER' as 'DEMO_ADAPTER' | 'LOCAL_FASTAPI_GEMINI',
  runtimeStatus: 'Demo Adapter Active (No Live LLM Connected)',
  memoryStatus: 'Demo Dataset Indexed · 17 Positions, 32 Tx, 9 Beancount Entries',
  lastExecution: '2026-11-02 14:22:10 UTC',
  /**
   * In Demo Mode, real token usage and real USD spend are 0 because no live Gemini calls occur.
   */
  realTokensUsedToday: 0,
  realBudgetUsedTodayUSD: 0.0,
  simulatedTasksExecutedToday: 14,
  errorCountToday: 0,
  guardrailInterceptionsCount: 3,
};

/**
 * Phase 1 Provider Strategy:
 * - Fixed to Gemini as the single primary cloud LLM provider (one shared GEMINI_API_KEY in backend).
 * - Local Ollama retained only as an optional global offline mode.
 * - No multi-cloud-key management (no Claude / OpenAI key selectors).
 */
export const MODEL_PROVIDER_PRESETS: ModelProviderPreset[] = [
  {
    id: 'preset-gemini-pro',
    provider: 'Gemini',
    model: 'gemini-2.5-pro',
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
    contextWindow: '2,000,000 tokens',
    latencyEstimate: 'Cloud Primary (Requires Backend GEMINI_API_KEY)',
    roleDescription: 'Phase 1 Primary Cloud Provider — All 6 task modes share one Gemini API key in the Python backend.',
  },
  {
    id: 'preset-gemini-flash',
    provider: 'Gemini',
    model: 'gemini-2.5-flash',
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
    contextWindow: '1,000,000 tokens',
    latencyEstimate: 'Low-Latency Cloud (Shares Same Backend GEMINI_API_KEY)',
    roleDescription: 'Low-latency Gemini model using the exact same backend GEMINI_API_KEY.',
  },
  {
    id: 'preset-local-ollama',
    provider: 'Local Ollama',
    model: 'qwen2.5-coder:32b-instruct-q4_K_M',
    base_url: 'http://127.0.0.1:11434/v1',
    contextWindow: '128,000 tokens',
    latencyEstimate: 'Optional Global Offline Mode (Local GPU)',
    roleDescription: 'Optional global offline provider on Kali Linux. Backend verifies local Ollama daemon on switch.',
  },
];

/**
 * Initial Unified Model Config in Demo Mode:
 * - `api_key_configured` is explicitly `false` (never pretending a key is verified in Demo Mode).
 * - `api_key_status` and `model_status` explicitly state `Simulated / Unknown (Unverified in Demo Mode)`.
 */
export const INITIAL_UNIFIED_MODEL_CONFIG: UnifiedModelConfig = {
  provider: 'Gemini',
  model: 'gemini-2.5-pro',
  base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
  api_key_configured: false,
  api_key_status: 'Simulated / Unknown (Unverified in Demo Mode)',
  model_status: 'Simulated / Unknown (Demo Mode)',
  request_timeout: 45,
  max_output_tokens: 4096,
  daily_budget_usd: 25.0,
  per_task_budget_usd: 0.75,
};

export const TASK_MODE_PROFILES: TaskModeProfile[] = [
  {
    mode: 'Accounting',
    tagline: 'Beancount Double-Entry Drafting, Normalization & Transfer Matching',
    instructions:
      'Inspect normalized bank and brokerage transactions, match internal cross-account transfer legs, verify double-entry conservation (Sum(Postings) == 0.00), and draft unposted Beancount entries for human sign-off.',
    accessibleTools: [
      'Read Accounts',
      'Read Transactions',
      'Read Beancount Ledger',
      'Calculate FX',
      'Calculate Cash Flow',
      'Verify Double-Entry Balance',
      'Generate Journal Draft',
      'Request Human Approval',
      'Record Audit Event',
    ],
    expectedOutputSchema: 'AccountingDraftResult { balanced: bool, residual_usd: Decimal, postings: list[BeancountPosting], confidence: float }',
    permittedDataScope: 'Accounts, Raw & Normalized Transactions, Beancount Chart of Accounts & Journal Entries',
    permissionRequirements: ['Read Raw Transactions', 'Draft Unposted Beancount Entries'],
    approvalPolicy: 'Required whenever classification confidence < 0.85 or before appending to main.beancount',
  },
  {
    mode: 'Portfolio Analysis',
    tagline: 'Multi-Brokerage Aggregation, Cost Basis & Yield Attribution',
    instructions:
      'Aggregate positions across Interactive Brokers, Charles Schwab, Firstrade, and European custody accounts; invoke deterministic return and FX calculators; never perform mental arithmetic.',
    accessibleTools: [
      'Read Accounts',
      'Read Holdings',
      'Read Market Data',
      'Calculate FX',
      'Calculate Portfolio Returns',
      'Generate Investment Analysis',
      'Record Audit Event',
    ],
    expectedOutputSchema: 'PortfolioAnalysisResult { total_investments_usd: Decimal, top_holdings: list[HoldingWeight], fx_exposure: dict[str, float] }',
    permittedDataScope: 'Portfolio Holdings, Account Cash Balances, Simulated FX & Benchmark History',
    permissionRequirements: ['Read Portfolio Holdings', 'Invoke Deterministic Return Calculator'],
    approvalPolicy: 'Read-Only Advisory (Human approval required for any rebalancing memo escalation)',
  },
  {
    mode: 'Research',
    tagline: 'Fundamental Synthesis, Macro Briefings & External Report Ingestion',
    instructions:
      'Synthesize fundamental earnings metrics, central bank rate paths, and read-only briefings from the independent Daily Analysis Connector (`daily_stock_analysis`) without modifying portfolio state.',
    accessibleTools: [
      'Read Holdings',
      'Read Market Data',
      'Read External Research Reports',
      'Generate Research Report',
      'Request Human Approval',
      'Record Audit Event',
    ],
    expectedOutputSchema: 'ResearchBriefingResult { report_id: str, symbols: list[str], sentiment: Literal["Constructive","Neutral","Cautious"], thesis_points: list[str] }',
    permittedDataScope: 'Market Watchlist, Economic Calendar, Internal & External Research Briefings',
    permissionRequirements: ['Read Market Intelligence', 'Draft Research Reports'],
    approvalPolicy: 'Human approval required if estimated token budget exceeds $0.50 USD',
  },
  {
    mode: 'Quantitative Research',
    tagline: 'Factor Formulation & Parameterized DuckDB/Parquet Backtesting',
    instructions:
      'Configure parameterized factor or technical strategy backtests against local DuckDB/Parquet OHLCV datasets, accounting for commission and slippage bps, and report Sharpe, Sortino, and max drawdown.',
    accessibleTools: [
      'Read Market Data',
      'Calculate Portfolio Returns',
      'Calculate Risk Metrics',
      'Run DuckDB Backtest',
      'Request Human Approval',
      'Record Audit Event',
    ],
    expectedOutputSchema: 'QuantExperimentResult { experiment_id: str, sharpe_ratio: float, sortino_ratio: float, max_drawdown_pct: float, total_return_pct: float }',
    permittedDataScope: 'Quant Strategy Templates, DuckDB Local Parquet OHLCV Store, Backtest Registry',
    permissionRequirements: ['Execute Simulated DuckDB Backtests', 'Append Experiment Registry'],
    approvalPolicy: 'Strict block on leverage > 1.0x or live order routing',
  },
  {
    mode: 'Audit',
    tagline: 'Ledger Integrity, Transfer Link Verification & Duplicate Fee Guard',
    instructions:
      'Cross-verify external institution statement balances against posted Beancount directives, verify internal transfer pairs, and detect duplicate custody or wire fees.',
    accessibleTools: [
      'Read Accounts',
      'Read Transactions',
      'Read Beancount Ledger',
      'Verify Double-Entry Balance',
      'Request Human Approval',
      'Record Audit Event',
    ],
    expectedOutputSchema: 'LedgerAuditResult { trial_balance_residual: Decimal, matched_transfer_pairs: int, flagged_anomalies: list[AnomalyItem] }',
    permittedDataScope: 'Full Read-Only Access to Accounts, Transactions, Beancount Ledger, and Append-Only Audit Log',
    permissionRequirements: ['Read Full Audit Trail', 'Escalate Discrepancies to Approval Inbox'],
    approvalPolicy: 'All anomalous fees or stale connectors escalated to Approval Inbox',
  },
  {
    mode: 'Risk Analysis',
    tagline: 'Single-Stock Concentration, Sector Ceiling, FX & Liquidity Stress',
    instructions:
      'Evaluate single-security weight against the 12.0% threshold, sector weight against the 40.0% ceiling, non-USD currency sensitivity (GBP/EUR), and liquidity buffer coverage.',
    accessibleTools: [
      'Read Accounts',
      'Read Holdings',
      'Read Market Data',
      'Calculate FX',
      'Calculate Risk Metrics',
      'Generate Investment Analysis',
      'Request Human Approval',
      'Record Audit Event',
    ],
    expectedOutputSchema: 'RiskAssessmentResult { max_drawdown_12m_pct: float, breaches: list[PolicyBreach], liquidity_ratio_pct: float }',
    permittedDataScope: 'Portfolio Holdings, Multi-Currency Cash Reserves, Risk Policy Thresholds',
    permissionRequirements: ['Read Portfolio Risk Metrics', 'Emit High-Priority Risk Warnings'],
    approvalPolicy: 'Automatic escalation to Approval Inbox when concentration limits are breached',
  },
];

export const INITIAL_TOOL_PERMISSIONS: AssistantToolPermission[] = [
  // Read-only tools
  {
    id: 'tool-read-accounts',
    name: 'Read Accounts',
    description: 'Read multi-institution account balances, currency codes, and sync timestamps.',
    category: 'Read-Only',
    enabled: true,
  },
  {
    id: 'tool-read-transactions',
    name: 'Read Transactions',
    description: 'Read normalized bank and brokerage transaction records and transfer links.',
    category: 'Read-Only',
    enabled: true,
  },
  {
    id: 'tool-read-holdings',
    name: 'Read Holdings',
    description: 'Read security positions, cost basis, and market values across brokerages.',
    category: 'Read-Only',
    enabled: true,
  },
  {
    id: 'tool-read-market',
    name: 'Read Market Data',
    description: 'Read watchlists, economic calendars, and simulated benchmark prices.',
    category: 'Read-Only',
    enabled: true,
  },
  {
    id: 'tool-read-ledger',
    name: 'Read Beancount Ledger',
    description: 'Read Beancount chart of accounts, trial balance, and posted journal entries.',
    category: 'Read-Only',
    enabled: true,
  },
  {
    id: 'tool-read-external-reports',
    name: 'Read External Research Reports',
    description: 'Read briefings from external read-only connectors such as daily_stock_analysis.',
    category: 'Read-Only',
    enabled: true,
  },

  // Deterministic computation tools
  {
    id: 'tool-calc-fx',
    name: 'Calculate FX',
    description: 'Convert native USD, GBP, and EUR amounts using deterministic FX rates.',
    category: 'Deterministic Computation',
    enabled: true,
  },
  {
    id: 'tool-calc-returns',
    name: 'Calculate Portfolio Returns',
    description: 'Compute deterministic cost basis, unrealized P&L, and time-weighted return metrics.',
    category: 'Deterministic Computation',
    enabled: true,
  },
  {
    id: 'tool-calc-cashflow',
    name: 'Calculate Cash Flow',
    description: 'Compute monthly inflows, outflows, and savings rate excluding internal transfers.',
    category: 'Deterministic Computation',
    enabled: true,
  },
  {
    id: 'tool-verify-balance',
    name: 'Verify Double-Entry Balance',
    description: 'Verify Sum(Postings) == 0.00 across all Beancount entries and trial balance.',
    category: 'Deterministic Computation',
    enabled: true,
  },
  {
    id: 'tool-calc-risk',
    name: 'Calculate Risk Metrics',
    description: 'Compute single-stock concentration, sector weights, volatility, and max drawdown.',
    category: 'Deterministic Computation',
    enabled: true,
  },
  {
    id: 'tool-run-backtest',
    name: 'Run DuckDB Backtest',
    description: 'Execute parameterized strategy backtests against local DuckDB/Parquet OHLCV data.',
    category: 'Deterministic Computation',
    enabled: true,
  },

  // Drafting tools
  {
    id: 'tool-gen-journal',
    name: 'Generate Journal Draft',
    description: 'Create unposted Beancount double-entry drafts queued for human approval.',
    category: 'Drafting',
    enabled: true,
  },
  {
    id: 'tool-gen-research',
    name: 'Generate Research Report',
    description: 'Draft structured fundamental or macro research notes for Market Intelligence.',
    category: 'Drafting',
    enabled: true,
  },
  {
    id: 'tool-gen-investment-analysis',
    name: 'Generate Investment Analysis',
    description: 'Draft cross-account asset allocation and concentration advisory memos.',
    category: 'Drafting',
    enabled: true,
  },

  // Governance tools
  {
    id: 'tool-req-approval',
    name: 'Request Human Approval',
    description: 'Escalate low-confidence journal drafts or risk alerts to the Approval Inbox.',
    category: 'Governance',
    enabled: true,
  },
  {
    id: 'tool-record-audit',
    name: 'Record Audit Event',
    description: 'Append cryptographic SHA-256 verification records to the immutable audit trail.',
    category: 'Governance',
    enabled: true,
  },

  // Permanently Prohibited Real Financial Operations
  {
    id: 'tool-prohibited-wire',
    name: 'Initiate Bank Transfer / Withdrawal (PROHIBITED)',
    description: 'Direct outbound wire or ACH initiation is permanently blocked in O-Finance.',
    category: 'Restricted (Prohibited)',
    enabled: false,
    lockedReadOnly: true,
  },
  {
    id: 'tool-prohibited-order',
    name: 'Submit Live Brokerage Order (PROHIBITED)',
    description: 'Live order execution on IBKR/Schwab/Firstrade is disabled by Read-Only Connector Policy.',
    category: 'Restricted (Prohibited)',
    enabled: false,
    lockedReadOnly: true,
  },
  {
    id: 'tool-prohibited-overwrite',
    name: 'Modify Raw Records / Post Unapproved Entries (PROHIBITED)',
    description: 'OFinanceAssistant cannot overwrite raw transactions or post unapproved ledger entries.',
    category: 'Restricted (Prohibited)',
    enabled: false,
    lockedReadOnly: true,
  },
];

export const GUARDRAIL_INTERCEPTION_LOGS = [
  {
    id: 'GRD-2026-003',
    timestamp: '2026-11-01 22:10:02 UTC',
    taskMode: 'Accounting' as const,
    attemptedAction: 'Auto-post Beancount entry JE-2026-007 ($1,480.00 Hetzner & AWS wire)',
    policyRule: 'Confidence Gate (confidence 0.64 < required 0.85 threshold)',
    resolution: 'Blocked direct ledger write; routed draft to Approval Inbox (APR-2026-001)',
  },
  {
    id: 'GRD-2026-002',
    timestamp: '2026-10-29 11:20:04 UTC',
    taskMode: 'Quantitative Research' as const,
    attemptedAction: 'Run Bollinger Mean Reversion backtest with 2.0x margin leverage parameter',
    policyRule: 'Max Leverage Guardrail (max_leverage == 1.0x unlevered cash only)',
    resolution: 'Intercepted parameter grid and logged rejection in APR-2026-010',
  },
  {
    id: 'GRD-2026-001',
    timestamp: '2026-10-18 09:00:11 UTC',
    taskMode: 'Portfolio Analysis' as const,
    attemptedAction: 'Probe Interactive Brokers live order routing endpoint',
    policyRule: 'Hard Read-Only Connector Policy (Zero Trade / Zero Withdrawal Enforcement)',
    resolution: 'Denied by Tool Permission Matrix; verified read-only Flex token scope',
  },
];

/**
 * Simulated Demo Task Logs:
 * Notice that `executionOrigin` is `'DEMO_ADAPTER'`, and `tokensUsed` / `estimatedCostUSD` are `null`
 * so Demo simulation records are never misrepresented as real Gemini API token/cost telemetry.
 */
export const INITIAL_ASSISTANT_TASK_LOGS: AssistantTaskLog[] = [
  { id: 'TASK-030', timestamp: '2026-11-02 14:22:10 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Risk Analysis', executionOrigin: 'DEMO_ADAPTER', trigger: 'User Prompt', taskSummary: 'Executed cross-account concentration & transfer audit in Risk Analysis mode', toolsInvoked: ['Read Holdings', 'Calculate Risk Metrics', 'Verify Double-Entry Balance'], durationMs: 640, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Aggregated 17 positions across 4 investment accounts; Information Technology exposure at 43.82%.' },
  { id: 'TASK-029', timestamp: '2026-11-02 14:20:45 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Audit', executionOrigin: 'DEMO_ADAPTER', trigger: 'Sync Hook', taskSummary: 'Verified internal transfer pair XFER-2026-881 ($10,000 US Bank -> IBKR)', toolsInvoked: ['Read Transactions', 'Read Beancount Ledger', 'Verify Double-Entry Balance'], durationMs: 310, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Confirmed zero net asset inflation; both transfer legs balanced in JE-2026-003.' },
  { id: 'TASK-028', timestamp: '2026-11-02 14:18:12 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Risk Analysis', executionOrigin: 'DEMO_ADAPTER', trigger: 'Scheduled Audit', taskSummary: 'Single-name concentration check on NVDA ($79,800 / 12.94% of investments)', toolsInvoked: ['Read Holdings', 'Calculate Risk Metrics', 'Request Human Approval'], durationMs: 520, tokensUsed: null, estimatedCostUSD: null, status: 'Approval Requested', outputPreview: 'NVDA exceeds 12.0% single-stock advisory threshold; queued review task APR-2026-003.' },
  { id: 'TASK-027', timestamp: '2026-11-02 14:16:05 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Accounting', executionOrigin: 'DEMO_ADAPTER', trigger: 'Sync Hook', taskSummary: 'Generated Beancount journal entry JE-2026-001 for 70 NVDA purchase', toolsInvoked: ['Read Transactions', 'Verify Double-Entry Balance', 'Generate Journal Draft'], durationMs: 410, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Balanced 3 postings including $1.05 IBKR commission.' },
  { id: 'TASK-026', timestamp: '2026-11-02 13:50:18 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Portfolio Analysis', executionOrigin: 'DEMO_ADAPTER', trigger: 'Manual Trigger', taskSummary: 'Computed YTD dividend and interest cash flow across USD, GBP, and EUR', toolsInvoked: ['Read Accounts', 'Read Holdings', 'Calculate FX', 'Calculate Portfolio Returns'], durationMs: 690, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'YTD Portfolio Dividends = $5,100.00 USD + €220.00 EUR ($5,340.24 USD equivalent).' },
  { id: 'TASK-025', timestamp: '2026-11-02 11:20:05 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Quantitative Research', executionOrigin: 'DEMO_ADAPTER', trigger: 'User Prompt', taskSummary: 'Executed 50/200 Dual EMA backtest EXP-901010 on SPY with 5bps commission', toolsInvoked: ['Read Market Data', 'Run DuckDB Backtest', 'Calculate Risk Metrics'], durationMs: 380, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Simulated Sharpe 1.78, Max Drawdown -1.59%, Total Return +21.95%.' },
  { id: 'TASK-024', timestamp: '2026-11-02 11:05:40 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Research', executionOrigin: 'DEMO_ADAPTER', trigger: 'Scheduled Audit', taskSummary: 'Published Q3 Semiconductor CapEx & AI Cluster Utilization briefing REP-2026-101', toolsInvoked: ['Read Holdings', 'Read Market Data', 'Generate Research Report'], durationMs: 1420, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Synthesized ASML backlog and TSMC CoWoS packaging capacity metrics.' },
  { id: 'TASK-023', timestamp: '2026-11-01 22:10:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Accounting', executionOrigin: 'DEMO_ADAPTER', trigger: 'Sync Hook', taskSummary: 'Flagged low-confidence wire TX-2026-008 ($1,480 Hetzner & AWS Clearing)', toolsInvoked: ['Read Transactions', 'Generate Journal Draft', 'Request Human Approval'], durationMs: 490, tokensUsed: null, estimatedCostUSD: null, status: 'Approval Requested', outputPreview: 'Confidence 0.64 below 0.85 auto-post threshold; routed to Approval Inbox APR-2026-001.' },
  { id: 'TASK-022', timestamp: '2026-11-01 19:45:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Quantitative Research', executionOrigin: 'DEMO_ADAPTER', trigger: 'Manual Trigger', taskSummary: 'Completed Cross-Sectional 12-1M Momentum backtest EXP-901009 on QQQ', toolsInvoked: ['Run DuckDB Backtest', 'Calculate Portfolio Returns'], durationMs: 610, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Annualized Return +25.34%, Sortino Ratio 2.68.' },
  { id: 'TASK-021', timestamp: '2026-11-01 18:05:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Audit', executionOrigin: 'DEMO_ADAPTER', trigger: 'Scheduled Audit', taskSummary: 'Detected stale PSD2 consent (>24h) on Frankfurt Euro Treasury & Depot', toolsInvoked: ['Read Accounts', 'Request Human Approval', 'Record Audit Event'], durationMs: 280, tokensUsed: null, estimatedCostUSD: null, status: 'Warning Flagged', outputPreview: 'EEA Bank connector last synced 2026-11-01 18:00 UTC; flagged in Account Health.' },
  { id: 'TASK-020', timestamp: '2026-10-31 16:30:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Research', executionOrigin: 'DEMO_ADAPTER', trigger: 'Manual Trigger', taskSummary: 'Generated G3 Central Bank Yield Curve Normalization report REP-2026-102', toolsInvoked: ['Read Market Data', 'Generate Research Report'], durationMs: 1180, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Compared SGOV 4.95% carry vs TLT duration convexity.' },
  { id: 'TASK-019', timestamp: '2026-10-30 17:00:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Accounting', executionOrigin: 'DEMO_ADAPTER', trigger: 'Sync Hook', taskSummary: 'Matched internal ACH transfer legs TX-2026-003A and TX-2026-003B', toolsInvoked: ['Read Transactions', 'Verify Double-Entry Balance', 'Generate Journal Draft'], durationMs: 350, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Linked transferGroupId XFER-2026-881 across US Bank and IBKR.' },
  { id: 'TASK-018', timestamp: '2026-10-30 16:12:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Quantitative Research', executionOrigin: 'DEMO_ADAPTER', trigger: 'User Prompt', taskSummary: 'Evaluated Bollinger & RSI Mean Reversion EXP-901008 on NVDA', toolsInvoked: ['Run DuckDB Backtest', 'Calculate Risk Metrics'], durationMs: 295, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Win rate 75.0%, Profit Factor 2.35 over 12-month window.' },
  { id: 'TASK-017', timestamp: '2026-10-29 15:00:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Accounting', executionOrigin: 'DEMO_ADAPTER', trigger: 'Sync Hook', taskSummary: 'Posted SCHD cash dividend ($362.64) to Income:Dividends:Schwab:SCHD', toolsInvoked: ['Read Transactions', 'Generate Journal Draft'], durationMs: 310, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Confidence 0.99; posted JE-2026-004.' },
  { id: 'TASK-016', timestamp: '2026-10-28 14:10:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Risk Analysis', executionOrigin: 'DEMO_ADAPTER', trigger: 'Scheduled Audit', taskSummary: 'Evaluated GBP & EUR FX sensitivity against USD base currency', toolsInvoked: ['Read Accounts', 'Calculate FX', 'Calculate Risk Metrics'], durationMs: 460, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Non-USD exposure stands at 14.6% (GBP 4.9%, EUR 9.7%).' },
  { id: 'TASK-015', timestamp: '2026-10-28 09:30:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Quantitative Research', executionOrigin: 'DEMO_ADAPTER', trigger: 'Manual Trigger', taskSummary: 'Ran Multi-Asset Donchian Breakout backtest EXP-901007 on VWRA/GLD/TLT/SGOV', toolsInvoked: ['Run DuckDB Backtest'], durationMs: 490, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Sharpe 2.08 with -2.10% max drawdown.' },
  { id: 'TASK-014', timestamp: '2026-10-27 16:40:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Accounting', executionOrigin: 'DEMO_ADAPTER', trigger: 'Sync Hook', taskSummary: 'Reconciled IBKR Spot FX conversion 5,000 GBP -> 6,425.00 USD', toolsInvoked: ['Read Transactions', 'Calculate FX', 'Generate Journal Draft'], durationMs: 430, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Recorded @ 1.2850 USD cost basis and $2.00 FX fee in JE-2026-006.' },
  { id: 'TASK-013', timestamp: '2026-10-26 15:20:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Portfolio Analysis', executionOrigin: 'DEMO_ADAPTER', trigger: 'Sync Hook', taskSummary: 'Updated VOO cost basis after 25-share purchase at Charles Schwab', toolsInvoked: ['Read Holdings', 'Calculate Portfolio Returns'], durationMs: 390, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'New VOO position: 125 shares @ $448.00 avg cost ($66,500 market value).' },
  { id: 'TASK-012', timestamp: '2026-10-25 14:05:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Quantitative Research', executionOrigin: 'DEMO_ADAPTER', trigger: 'Manual Trigger', taskSummary: 'Tested Quality + Low Vol + FCF composite factor EXP-901006 on VOO', toolsInvoked: ['Run DuckDB Backtest'], durationMs: 740, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Total Return +16.20% vs SPY +9.60%.' },
  { id: 'TASK-011', timestamp: '2026-10-24 11:00:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Research', executionOrigin: 'DEMO_ADAPTER', trigger: 'Scheduled Audit', taskSummary: 'Published Microsoft Cloud Commercial RPO note REP-2026-104', toolsInvoked: ['Read Market Data', 'Generate Research Report'], durationMs: 1310, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Analyzed Azure infrastructure capex efficiency.' },
  { id: 'TASK-010', timestamp: '2026-10-22 18:30:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Accounting', executionOrigin: 'DEMO_ADAPTER', trigger: 'Sync Hook', taskSummary: 'Combined TSM gross dividend ($340) and 21% Taiwan withholding tax ($71.40)', toolsInvoked: ['Read Transactions', 'Generate Journal Draft'], durationMs: 440, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Posted composite Beancount entry JE-2026-008.' },
  { id: 'TASK-009', timestamp: '2026-10-20 16:00:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Audit', executionOrigin: 'DEMO_ADAPTER', trigger: 'Sync Hook', taskSummary: 'Verified internal ACH transfer XFER-2026-742 ($5,000 US Bank -> Schwab)', toolsInvoked: ['Read Transactions', 'Read Beancount Ledger'], durationMs: 290, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Excluded $5,000 internal transfer from monthly income/expense totals.' },
  { id: 'TASK-008', timestamp: '2026-10-18 11:40:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Quantitative Research', executionOrigin: 'DEMO_ADAPTER', trigger: 'Manual Trigger', taskSummary: 'Ran ASML Mean Reversion experiment EXP-901004', toolsInvoked: ['Run DuckDB Backtest'], durationMs: 315, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Sharpe 1.32, Profit Factor 1.98.' },
  { id: 'TASK-007', timestamp: '2026-10-15 17:15:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Accounting', executionOrigin: 'DEMO_ADAPTER', trigger: 'User Prompt', taskSummary: 'Executed mid-month cash flow & savings rate review', toolsInvoked: ['Read Accounts', 'Read Transactions', 'Calculate Cash Flow'], durationMs: 780, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Confirmed settled cash flow excluding $15,000 internal transfers.' },
  { id: 'TASK-006', timestamp: '2026-10-12 16:05:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Portfolio Analysis', executionOrigin: 'DEMO_ADAPTER', trigger: 'Sync Hook', taskSummary: 'Calculated realized capital gain ($1,124.00) on 30 NVDA trim', toolsInvoked: ['Read Holdings', 'Calculate Portfolio Returns'], durationMs: 360, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Updated IBKR YTD realized P&L.' },
  { id: 'TASK-005', timestamp: '2026-10-08 19:20:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Accounting', executionOrigin: 'DEMO_ADAPTER', trigger: 'Sync Hook', taskSummary: 'Drafted JE-2026-009 for OneMedical executive health diagnostic ($640)', toolsInvoked: ['Read Transactions', 'Generate Journal Draft', 'Request Human Approval'], durationMs: 420, tokensUsed: null, estimatedCostUSD: null, status: 'Approval Requested', outputPreview: 'Confidence 0.81; queued APR-2026-002 for human verification.' },
  { id: 'TASK-004', timestamp: '2026-10-05 14:50:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Portfolio Analysis', executionOrigin: 'DEMO_ADAPTER', trigger: 'Sync Hook', taskSummary: 'Verified LSE UCITS execution for 52 VWRA shares ($7,033.90)', toolsInvoked: ['Read Holdings', 'Read Transactions'], durationMs: 340, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Global equity allocation increased by +0.85%.' },
  { id: 'TASK-003', timestamp: '2026-10-01 12:30:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Accounting', executionOrigin: 'DEMO_ADAPTER', trigger: 'Sync Hook', taskSummary: 'Classified $4,200 IRS EFTPS Q3 estimated tax payment', toolsInvoked: ['Read Transactions', 'Generate Journal Draft'], durationMs: 330, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'Posted to Expenses:Taxes:FederalEstimated.' },
  { id: 'TASK-002', timestamp: '2026-09-25 16:10:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Risk Analysis', executionOrigin: 'DEMO_ADAPTER', trigger: 'Sync Hook', taskSummary: 'Checked Crypto ETF (IBIT) allocation cap after 207-share addition', toolsInvoked: ['Read Holdings', 'Calculate Risk Metrics'], durationMs: 410, tokensUsed: null, estimatedCostUSD: null, status: 'Success (Demo Adapter)', outputPreview: 'IBIT weight at 4.59% of investment portfolio (within 5.0% policy cap).' },
  { id: 'TASK-001', timestamp: '2026-09-15 09:45:00 UTC', assistantName: 'OFinanceAssistant', taskMode: 'Audit', executionOrigin: 'DEMO_ADAPTER', trigger: 'Sync Hook', taskSummary: 'Flagged duplicate €45.00 custody maintenance fee at Frankfurt Euro Bank', toolsInvoked: ['Read Transactions', 'Request Human Approval'], durationMs: 370, tokensUsed: null, estimatedCostUSD: null, status: 'Warning Flagged', outputPreview: 'Duplicate charge within 48h detected; escalated to Approval Inbox APR-2026-004.' },
];

export const INITIAL_PLAYGROUND_MESSAGES: PlaygroundMessage[] = [
  {
    id: 'MSG-1',
    role: 'user',
    timestamp: '2026-11-02 14:21:50 UTC',
    taskMode: 'Risk Analysis',
    executionOrigin: 'DEMO_ADAPTER',
    content: 'Analyze my concentration risk across all brokerage accounts and check for any unmatched internal transfers.',
  },
  {
    id: 'MSG-2',
    role: 'assistant',
    timestamp: '2026-11-02 14:22:10 UTC',
    taskMode: 'Risk Analysis',
    executionOrigin: 'DEMO_ADAPTER',
    content:
      '[DEMO ADAPTER · DETERMINISTIC SIMULATION — NO LIVE GEMINI API CALL] OFinanceAssistant (Risk Analysis Mode) executed 4 deterministic tool functions over the in-memory Demo dataset:',
    toolTimeline: [
      {
        stepNumber: 1,
        toolName: 'Read Holdings',
        category: 'Read-Only',
        callSignature: 'read_holdings(accounts=["acc-ibkr", "acc-schwab", "acc-firstrade", "acc-eu-bank"])',
        status: 'Completed (Demo Deterministic)',
        deterministicFinding:
          'Loaded 17 active positions across 4 brokerage accounts totaling $616,572.00 USD equivalent.',
        durationMs: 120,
      },
      {
        stepNumber: 2,
        toolName: 'Calculate Risk Metrics',
        category: 'Deterministic Computation',
        callSignature: 'calculate_risk_metrics(max_single_weight=0.12, max_sector_weight=0.40)',
        status: 'Completed (Demo Deterministic)',
        deterministicFinding:
          'BREACH DETECTED: NVDA ($79,800.00 / 12.94%) exceeds 12.0% single-stock cap by +0.94%. Information Technology sector weight is 43.82% (+3.82% above 40.0% ceiling).',
        durationMs: 190,
      },
      {
        stepNumber: 3,
        toolName: 'Verify Double-Entry Balance',
        category: 'Deterministic Computation',
        callSignature: 'verify_double_entry_balance(check_transfer_pairs=True)',
        status: 'Completed (Demo Deterministic)',
        deterministicFinding:
          '2 internal transfer pairs ($10,000 US Bank -> IBKR [XFER-2026-881] and $5,000 US Bank -> Schwab [XFER-2026-742]) are matched with 0.00 USD trial balance residual.',
        durationMs: 150,
      },
      {
        stepNumber: 4,
        toolName: 'Generate Investment Analysis',
        category: 'Drafting',
        callSignature: 'generate_investment_analysis(output_schema="RiskAssessmentResult")',
        status: 'Completed (Demo Deterministic)',
        deterministicFinding:
          'Compiled structured RiskAssessmentResult and linked pending human review task APR-2026-003.',
        durationMs: 180,
      },
    ],
    structuredMetrics: [
      { label: 'Total Investments (USD)', value: '$616,572.00', delta: '4 Brokerages' },
      { label: 'Top Single Position (NVDA)', value: '12.94%', delta: '+0.94% over cap' },
      { label: 'IT & Semiconductor Sector', value: '43.82%', delta: '+3.82% over cap' },
      { label: 'Unmatched Internal Transfers', value: '0 ($0.00)', delta: '2 Pairs Verified' },
    ],
  },
];
