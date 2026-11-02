export type CurrencyCode = 'USD' | 'GBP' | 'EUR';

export type AccountType = 'Brokerage' | 'Checking' | 'Savings' | 'CreditCard' | 'Crypto' | 'Loan';

export type ConnectionStatus =
  | 'Connected (Simulated)'
  | 'Not Connected'
  | 'Authorization Required'
  | 'Syncing'
  | 'Sync Failed'
  | 'Stale Data'
  | 'Demo Only';

export type DataFreshness = 'Simulated Live' | 'Simulated 15m Ago' | 'Simulated 4h Ago' | 'Stale (24h+)';

export interface FinancialAccount {
  id: string;
  institution: string;
  accountName: string;
  accountNumberMasked: string;
  accountType: AccountType;
  currency: CurrencyCode;
  currentBalance: number; // Cash + Investment value in account currency (or negative for liabilities)
  availableCash: number;  // Cash available in account currency
  investmentValue: number; // Holdings market value in account currency
  liabilityAmount: number; // Debt/liability in account currency
  lastSync: string;
  connectionStatus: ConnectionStatus;
  dataFreshness: DataFreshness;
  region: 'US' | 'UK' | 'EEA' | 'Global';
  connectorId: string;
}

export interface ConnectorConfig {
  id: string;
  institution: string;
  category: 'Brokerage' | 'Bank' | 'Future';
  plannedConnector: string;
  supportedData: string[];
  authMethod: string;
  connectionStatus:
    | 'Not Connected / Demo Only'
    | 'Simulated Connected'
    | 'Authorization Required (Sim)'
    | 'Syncing (Sim)'
    | 'Sync Failed (Sim)'
    | 'Stale Data (24h+)'
    | 'Disconnected';
  lastSyncTime: string;
  syncFrequency: string;
  permissionsScope: string;
  configStatus: 'Mock Ready' | 'Placeholder' | 'Requires Local Backend';
  region: string;
}

export type TransactionType =
  | 'Deposit'
  | 'Withdrawal'
  | 'Buy'
  | 'Sell'
  | 'Dividend'
  | 'Interest'
  | 'Fee'
  | 'Transfer'
  | 'FX Conversion'
  | 'Refund'
  | 'Tax'
  | 'Other';

export type LedgerStatus = 'Posted' | 'Pending Approval' | 'Unposted' | 'Draft' | 'Anomaly Flagged';

export interface TransactionRecord {
  id: string;
  date: string;
  institution: string;
  accountId: string;
  accountName: string;
  description: string;
  payee: string;
  symbol?: string;
  quantity?: number;
  price?: number;
  fees: number;
  amount: number; // Signed amount in native currency
  currency: CurrencyCode;
  type: TransactionType;
  category: string;
  direction: 'Inflow' | 'Outflow' | 'Internal Transfer';
  status: 'Settled' | 'Pending' | 'Flagged';
  ledgerStatus: LedgerStatus;
  journalEntryId?: string;
  transferGroupId?: string; // Links two legs of an internal cross-account transfer
  transferCounterpartyAccount?: string;
  rawSourceJson: string;
  dataSource: string;
}

export interface BeancountPosting {
  account: string;
  amount: number;
  currency: CurrencyCode;
  costBasis?: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  flag: '*' | '!';
  payee: string;
  narration: string;
  transactionId?: string;
  status: 'Posted' | 'Draft' | 'Pending Approval' | 'Rejected';
  confidence?: number;
  sourceDocument: string;
  postings: BeancountPosting[];
  rawBeancount: string;
}

export type AssetClass =
  | 'US Equities'
  | 'International Equities'
  | 'ETFs'
  | 'Bonds'
  | 'Cash'
  | 'REITs'
  | 'Crypto'
  | 'Other Assets';

export interface PortfolioHolding {
  id: string;
  symbol: string;
  securityName: string;
  assetType: AssetClass;
  accountId: string;
  accountName: string;
  institution: string;
  market: 'US' | 'UK' | 'EU' | 'Global';
  sector: string;
  country: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  costBasisTotal: number;
  unrealizedPnL: number;
  returnPct: number;
  realizedPnLYTD: number;
  dividendsYTD: number;
  currency: CurrencyCode;
  lastPriceUpdate: string;
  recentChanges: { date: string; action: string; shares: number; price: number }[];
}

export type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

export interface HistoricalPoint {
  date: string;
  label: string;
  netWorthUSD: number;
  cashUSD: number;
  investmentsUSD: number;
  liabilitiesUSD: number;
  benchmarkReturnPct: number;
  portfolioReturnPct: number;
}

export interface CashFlowPoint {
  month: string;
  inflowUSD: number;
  outflowUSD: number;
  netSavingsUSD: number;
  dividendsUSD: number;
}

export interface QuantStrategy {
  id: string;
  name: string;
  category: 'Trend' | 'Momentum' | 'Mean Reversion' | 'Multi-Factor' | 'StatArb';
  description: string;
  universe: string;
  rebalanceFreq: string;
  parameters: Record<string, string | number>;
  defaultSymbol: string;
  defaultBenchmark: string;
  status: 'Active Research' | 'Validated (Simulated)' | 'Draft';
  codeSnippet: string;
}

export interface BacktestExperiment {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  benchmark: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  commissionBps: number;
  slippageBps: number;
  parameters: string;
  dataset: string;
  executionTimeMs: number;
  createdAt: string;
  status: 'Completed (Simulated)' | 'Failed';
  metrics: {
    totalReturnPct: number;
    annualizedReturnPct: number;
    benchmarkReturnPct: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdownPct: number;
    winRatePct: number;
    profitFactor: number;
  };
  equityCurve: { date: string; strategyEquity: number; benchmarkEquity: number; drawdownPct: number }[];
  monthlyReturns: { month: string; returnPct: number }[];
}

export type AgentRoleId =
  | 'orchestrator'
  | 'accounting'
  | 'investment'
  | 'research'
  | 'quant'
  | 'auditor'
  | 'risk';

export interface AgentToolPermission {
  id: string;
  name: string;
  description: string;
  category: 'Read-Only' | 'Computation' | 'Drafting' | 'Governance' | 'Restricted (Prohibited)';
  enabled: boolean;
  lockedReadOnly?: boolean;
}

export interface AIModelConfig {
  id: string;
  provider: 'Local Ollama' | 'Gemini' | 'Claude' | 'OpenAI-Compatible';
  modelName: string;
  endpoint: string;
  contextWindow: string;
  status: 'Simulated Configured' | 'Local Standby' | 'Unconfigured';
  latencyEstimate: string;
}

export interface AgentDefinition {
  id: AgentRoleId;
  name: string;
  role: string;
  description: string;
  responsibilities: string[];
  runtimeStatus: 'Standby (Mock Runtime)' | 'Simulated Active' | 'Offline';
  assignedModelId: string;
  tools: string[];
  permissions: string[];
  memoryStatus: string;
  lastExecution: string;
  tokensUsedToday: number;
  executionBudgetUSD: number;
  budgetUsedUSD: number;
  errorCount: number;
}

export interface AgentExecutionLog {
  id: string;
  timestamp: string;
  agentId: AgentRoleId;
  agentName: string;
  trigger: 'User Prompt' | 'Scheduled Audit' | 'Sync Hook' | 'Manual Trigger';
  taskSummary: string;
  toolsInvoked: string[];
  durationMs: number;
  tokensUsed: number;
  status: 'Success (Simulated)' | 'Approval Requested' | 'Warning Flagged';
  outputPreview: string;
}

export interface PlaygroundMessage {
  id: string;
  role: 'user' | 'orchestrator';
  timestamp: string;
  content: string;
  promptType?: string;
  delegatedAgents?: {
    agentId: AgentRoleId;
    agentName: string;
    stepTitle: string;
    toolCalled: string;
    status: 'Completed (Simulated)';
    finding: string;
  }[];
  structuredMetrics?: { label: string; value: string; delta?: string }[];
}

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export interface ApprovalTask {
  id: string;
  source: 'Transaction Normalization' | 'Beancount Journal Draft' | 'Anomaly Detection' | 'Reconciliation Check' | 'Duplicate Guard' | 'Agent Risk Alert' | 'Research Task';
  agentId: AgentRoleId;
  agentName: string;
  title: string;
  description: string;
  amount?: number;
  currency?: CurrencyCode;
  confidence: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  createdAt: string;
  status: ApprovalStatus;
  proposedAction: string;
  rawPayload: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  category:
    | 'Agent Execution'
    | 'Account Sync'
    | 'API Access'
    | 'Approval Decision'
    | 'Ledger Change'
    | 'Auth Event'
    | 'Security Warning';
  actor: string;
  action: string;
  target: string;
  severity: 'Info' | 'Warning' | 'High';
  verificationHash: string;
  details: string;
}

export interface MarketWatchItem {
  symbol: string;
  name: string;
  market: string;
  price: number;
  changePct: number;
  currency: CurrencyCode;
  volume: string;
  peRatio: number;
  dividendYieldPct: number;
  updatedAt: string;
}

export interface ResearchReportItem {
  id: string;
  date: string;
  title: string;
  source: string;
  symbols: string[];
  category: 'Earnings' | 'Macro' | 'Sector' | 'Quant Note' | 'External Connector';
  summary: string;
  sentiment: 'Constructive' | 'Neutral' | 'Cautious';
  readTime: string;
}

export interface EconomicCalendarEvent {
  id: string;
  date: string;
  timeUTC: string;
  region: 'US' | 'UK' | 'EU' | 'Global';
  event: string;
  impact: 'High' | 'Medium' | 'Low';
  previous: string;
  consensus: string;
  simulatedActual: string;
}

export interface SystemSettingsState {
  defaultCurrency: CurrencyCode;
  timezone: string;
  theme: 'dark' | 'light';
  autoSyncEnabled: boolean;
  syncFrequency: '15m' | '1h' | '6h' | '24h' | 'Manual Only';
  localBackendUrl: string;
  favaUrl: string;
  beancountFilePath: string;
  dailyAnalysisApiUrl: string;
  agentDailyBudgetUSD: number;
  agentMaxStepsPerRun: number;
  strictHumanInTheLoop: boolean;
  readOnlyConnectorsEnforced: boolean;
  dataRetentionDays: number;
}
