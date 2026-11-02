import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  CurrencyCode,
  FinancialAccount,
  ConnectorConfig,
  TransactionRecord,
  JournalEntry,
  PortfolioHolding,
  QuantStrategy,
  BacktestExperiment,
  AgentDefinition,
  AIModelConfig,
  AgentToolPermission,
  AgentExecutionLog,
  PlaygroundMessage,
  ApprovalTask,
  AuditLogEntry,
  MarketWatchItem,
  ResearchReportItem,
  EconomicCalendarEvent,
  SystemSettingsState,
  AgentRoleId,
} from '../../types';
import { INITIAL_ACCOUNTS, INITIAL_CONNECTORS } from '../../mocks/accounts';
import { INITIAL_HOLDINGS } from '../../mocks/portfolio';
import { INITIAL_TRANSACTIONS, INITIAL_JOURNAL_ENTRIES } from '../../mocks/transactions';
import {
  NET_WORTH_HISTORY_12M,
  CASH_FLOW_12M,
  INITIAL_WATCHLIST,
  INITIAL_RESEARCH_REPORTS,
  ECONOMIC_CALENDAR_EVENTS,
  INITIAL_STRATEGIES,
  INITIAL_BACKTESTS,
} from '../../mocks/reports';
import {
  INITIAL_AGENTS,
  INITIAL_AI_MODELS,
  INITIAL_TOOL_PERMISSIONS,
  INITIAL_AGENT_LOGS,
  INITIAL_PLAYGROUND_MESSAGES,
} from '../../mocks/agents';
import { INITIAL_APPROVAL_TASKS, INITIAL_AUDIT_LOGS } from '../../mocks/audit';
import {
  calculateWealthSummary,
  AggregatedWealthSummary,
  runDeterministicBacktest,
} from '../../utils/finance';

export interface SyncHistoryItem {
  id: string;
  timestamp: string;
  institution: string;
  recordsProcessed: number;
  durationMs: number;
  status: 'Simulated Success' | 'Simulated Warning';
  note: string;
}

interface OFinanceContextValue {
  // Global UI & Settings
  baseCurrency: CurrencyCode;
  setBaseCurrency: (c: CurrencyCode) => void;
  settings: SystemSettingsState;
  updateSettings: (partial: Partial<SystemSettingsState>) => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;
  toastMessage: { text: string; type: 'info' | 'success' | 'warning' } | null;
  showToast: (text: string, type?: 'info' | 'success' | 'warning') => void;

  // Financial Entities
  accounts: FinancialAccount[];
  connectors: ConnectorConfig[];
  holdings: PortfolioHolding[];
  transactions: TransactionRecord[];
  journalEntries: JournalEntry[];
  wealthSummary: AggregatedWealthSummary;
  netWorthHistory: typeof NET_WORTH_HISTORY_12M;
  cashFlowHistory: typeof CASH_FLOW_12M;

  // Market & Quant
  watchlist: MarketWatchItem[];
  researchReports: ResearchReportItem[];
  economicCalendar: EconomicCalendarEvent[];
  strategies: QuantStrategy[];
  backtests: BacktestExperiment[];
  runSimulatedBacktest: (params: {
    strategyId: string;
    symbol: string;
    benchmark: string;
    startDate: string;
    endDate: string;
    initialCapital: number;
    commissionBps: number;
    slippageBps: number;
  }) => BacktestExperiment;

  // Agents, Approvals & Audit
  agents: AgentDefinition[];
  aiModels: AIModelConfig[];
  toolPermissions: AgentToolPermission[];
  agentLogs: AgentExecutionLog[];
  playgroundMessages: PlaygroundMessage[];
  approvalTasks: ApprovalTask[];
  auditLogs: AuditLogEntry[];

  // Interactive Actions
  isSyncing: boolean;
  lastGlobalSync: string;
  syncHistory: SyncHistoryItem[];
  failedSyncQueue: { id: string; institution: string; error: string; timestamp: string }[];
  triggerSimulatedSync: (institutionName?: string) => void;
  retryFailedSync: (id: string) => void;
  toggleConnectorState: (connectorId: string) => void;
  assignAgentModel: (agentId: AgentRoleId, modelId: string) => void;
  toggleToolPermission: (toolId: string) => void;
  sendPlaygroundPrompt: (promptText: string) => void;
  decideApprovalTask: (taskId: string, decision: 'Approved' | 'Rejected', editedPayload?: string) => void;
  approveJournalDraft: (entryId: string) => void;
  rejectJournalDraft: (entryId: string) => void;
  appendAuditLog: (entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'verificationHash'>) => void;
}

const OFinanceContext = createContext<OFinanceContextValue | undefined>(undefined);

const DEFAULT_SETTINGS: SystemSettingsState = {
  defaultCurrency: 'USD',
  timezone: 'UTC (Coordinated Universal Time)',
  theme: 'dark',
  autoSyncEnabled: true,
  syncFrequency: '6h',
  localBackendUrl: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
  favaUrl: import.meta.env.VITE_FAVA_URL || 'http://127.0.0.1:5000',
  beancountFilePath: '~/o-finance/ledger/main.beancount',
  dailyAnalysisApiUrl: 'http://127.0.0.1:8090/api/v1/reports',
  agentDailyBudgetUSD: 25.0,
  agentMaxStepsPerRun: 8,
  strictHumanInTheLoop: true,
  readOnlyConnectorsEnforced: true,
  dataRetentionDays: 3650,
};

export const OFinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettingsState>(() => {
    try {
      const saved = localStorage.getItem('ofinance_demo_settings_v1');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      // ignore storage errors
    }
    return DEFAULT_SETTINGS;
  });

  const [baseCurrency, setBaseCurrencyState] = useState<CurrencyCode>(settings.defaultCurrency);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'info' | 'success' | 'warning' } | null>(null);

  const [accounts, setAccounts] = useState<FinancialAccount[]>(INITIAL_ACCOUNTS);
  const [connectors, setConnectors] = useState<ConnectorConfig[]>(INITIAL_CONNECTORS);
  const [holdings] = useState<PortfolioHolding[]>(INITIAL_HOLDINGS);
  const [transactions, setTransactions] = useState<TransactionRecord[]>(INITIAL_TRANSACTIONS);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(INITIAL_JOURNAL_ENTRIES);

  const [watchlist] = useState<MarketWatchItem[]>(INITIAL_WATCHLIST);
  const [researchReports] = useState<ResearchReportItem[]>(INITIAL_RESEARCH_REPORTS);
  const [economicCalendar] = useState<EconomicCalendarEvent[]>(ECONOMIC_CALENDAR_EVENTS);
  const [strategies] = useState<QuantStrategy[]>(INITIAL_STRATEGIES);
  const [backtests, setBacktests] = useState<BacktestExperiment[]>(INITIAL_BACKTESTS);

  const [agents, setAgents] = useState<AgentDefinition[]>(INITIAL_AGENTS);
  const [aiModels] = useState<AIModelConfig[]>(INITIAL_AI_MODELS);
  const [toolPermissions, setToolPermissions] = useState<AgentToolPermission[]>(INITIAL_TOOL_PERMISSIONS);
  const [agentLogs, setAgentLogs] = useState<AgentExecutionLog[]>(INITIAL_AGENT_LOGS);
  const [playgroundMessages, setPlaygroundMessages] = useState<PlaygroundMessage[]>(INITIAL_PLAYGROUND_MESSAGES);
  const [approvalTasks, setApprovalTasks] = useState<ApprovalTask[]>(INITIAL_APPROVAL_TASKS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastGlobalSync, setLastGlobalSync] = useState('2026-11-02 14:20:00 UTC');
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([
    { id: 'SH-104', timestamp: '2026-11-02 14:20:00 UTC', institution: 'US Bank (Plaid Mock)', recordsProcessed: 14, durationMs: 320, status: 'Simulated Success', note: 'Simulated Sync — No Real Financial Institution Connected' },
    { id: 'SH-103', timestamp: '2026-11-02 14:15:00 UTC', institution: 'Interactive Brokers (Flex Mock)', recordsProcessed: 28, durationMs: 490, status: 'Simulated Success', note: 'Simulated Sync — No Real Financial Institution Connected' },
    { id: 'SH-102', timestamp: '2026-11-02 14:10:00 UTC', institution: 'Charles Schwab (Trader Mock)', recordsProcessed: 19, durationMs: 410, status: 'Simulated Success', note: 'Simulated Sync — No Real Financial Institution Connected' },
    { id: 'SH-101', timestamp: '2026-11-01 18:00:00 UTC', institution: 'EEA Bank (PSD2 Mock)', recordsProcessed: 0, durationMs: 850, status: 'Simulated Warning', note: 'PSD2 90-day read-only consent expired in Demo Simulation' },
  ]);

  const [failedSyncQueue, setFailedSyncQueue] = useState([
    {
      id: 'FSQ-1',
      institution: 'European Bank (Frankfurt Euro Treasury)',
      error: 'Simulated PSD2 AIS 90-day consent renewal required (DEMO ONLY)',
      timestamp: '2026-11-02 06:00:00 UTC',
    },
  ]);

  // Apply Dark/Light theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  const showToast = (text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 3800);
  };

  const appendAuditLog = (entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'verificationHash'>) => {
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const randomHex = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    const newEntry: AuditLogEntry = {
      ...entry,
      id: `AUD-${1021 + auditLogs.length}`,
      timestamp: nowStr,
      verificationHash: `sha256:${randomHex}...demo`,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };

  const setBaseCurrency = (c: CurrencyCode) => {
    setBaseCurrencyState(c);
    setSettings((prev) => {
      const next = { ...prev, defaultCurrency: c };
      try {
        localStorage.setItem('ofinance_demo_settings_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    showToast(`Display Base Currency switched to ${c} (Deterministic Simulated FX applied)`, 'info');
  };

  const updateSettings = (partial: Partial<SystemSettingsState>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      if (partial.defaultCurrency) {
        setBaseCurrencyState(partial.defaultCurrency);
      }
      try {
        localStorage.setItem('ofinance_demo_settings_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    appendAuditLog({
      category: 'Auth Event',
      actor: 'Local Workstation Operator',
      action: `Updated system settings (${Object.keys(partial).join(', ')})`,
      target: 'Local Demo Configuration',
      severity: 'Info',
      details: 'Saved to local browser storage (VITE_DEMO_MODE=true).',
    });
    showToast('System settings saved to local Demo state.', 'success');
  };

  const wealthSummary = useMemo(
    () => calculateWealthSummary(accounts, holdings, baseCurrency),
    [accounts, holdings, baseCurrency]
  );

  const triggerSimulatedSync = (institutionName?: string) => {
    if (isSyncing) return;
    setIsSyncing(true);
    const targetLabel = institutionName || 'All Connected Demo Accounts';
    showToast(`Simulated Sync started for ${targetLabel} — No Real Financial Institution Connected`, 'info');

    setTimeout(() => {
      const nowStr = '2026-11-02 ' + new Date().toTimeString().slice(0, 8) + ' UTC';
      setLastGlobalSync(nowStr);
      setAccounts((prev) =>
        prev.map((acc) => {
          if (!institutionName || acc.institution.includes(institutionName)) {
            return {
              ...acc,
              lastSync: nowStr,
              connectionStatus: 'Connected (Simulated)',
              dataFreshness: 'Simulated Live',
            };
          }
          return acc;
        })
      );
      setSyncHistory((prev) => [
        {
          id: `SH-${105 + prev.length}`,
          timestamp: nowStr,
          institution: targetLabel,
          recordsProcessed: 18,
          durationMs: 340,
          status: 'Simulated Success',
          note: 'Simulated Sync — No Real Financial Institution Connected',
        },
        ...prev,
      ]);
      appendAuditLog({
        category: 'Account Sync',
        actor: 'SyncService (Mock Adapter)',
        action: `Triggered simulated sync for ${targetLabel}`,
        target: targetLabel,
        severity: 'Info',
        details: 'Simulated Sync — No Real Financial Institution Connected.',
      });
      setIsSyncing(false);
      showToast(`Simulated Sync complete (${targetLabel}) · DEMO DATA ONLY`, 'success');
    }, 650);
  };

  const retryFailedSync = (id: string) => {
    const item = failedSyncQueue.find((f) => f.id === id);
    if (!item) return;
    setFailedSyncQueue((prev) => prev.filter((f) => f.id !== id));
    triggerSimulatedSync(item.institution);
  };

  const toggleConnectorState = (connectorId: string) => {
    const cycleOrder: ConnectorConfig['connectionStatus'][] = [
      'Simulated Connected',
      'Not Connected / Demo Only',
      'Authorization Required (Sim)',
      'Sync Failed (Sim)',
      'Stale Data (24h+)',
    ];
    setConnectors((prev) =>
      prev.map((c) => {
        if (c.id !== connectorId) return c;
        const idx = cycleOrder.indexOf(c.connectionStatus);
        const nextStatus = cycleOrder[(idx + 1) % cycleOrder.length];
        appendAuditLog({
          category: 'Account Sync',
          actor: 'Local Workstation Operator',
          action: `Changed connector status to "${nextStatus}"`,
          target: `${c.institution} (${c.plannedConnector})`,
          severity: 'Info',
          details: 'DEMO Mode simulated authorization/status cycle. Zero real credentials transmitted.',
        });
        showToast(
          `${c.institution}: ${nextStatus} (DEMO SIMULATION ONLY)`,
          nextStatus === 'Simulated Connected' ? 'success' : 'info'
        );
        return {
          ...c,
          connectionStatus: nextStatus,
          lastSyncTime:
            nextStatus === 'Simulated Connected'
              ? '2026-11-02 ' + new Date().toTimeString().slice(0, 8) + ' UTC (Simulated)'
              : c.lastSyncTime,
        };
      })
    );
  };

  const assignAgentModel = (agentId: AgentRoleId, modelId: string) => {
    const modelObj = aiModels.find((m) => m.id === modelId);
    setAgents((prev) =>
      prev.map((ag) => (ag.id === agentId ? { ...ag, assignedModelId: modelId } : ag))
    );
    appendAuditLog({
      category: 'Agent Execution',
      actor: 'Local Workstation Operator',
      action: `Assigned model ${modelObj?.modelName || modelId} to ${agentId} agent`,
      target: `Agent: ${agentId}`,
      severity: 'Info',
      details: 'Model routing updated in Mock Agent Runtime.',
    });
    showToast(`Assigned ${modelObj?.modelName} to ${agentId.toUpperCase()} Agent (Mock Runtime)`, 'success');
  };

  const toggleToolPermission = (toolId: string) => {
    const target = toolPermissions.find((t) => t.id === toolId);
    if (!target) return;
    if (target.lockedReadOnly) {
      showToast('Write/Execution tools are permanently disabled by O-Finance Read-Only Security Policy.', 'warning');
      return;
    }
    setToolPermissions((prev) =>
      prev.map((t) => (t.id === toolId ? { ...t, enabled: !t.enabled } : t))
    );
    appendAuditLog({
      category: 'Security Warning',
      actor: 'Local Workstation Operator',
      action: `${!target.enabled ? 'Enabled' : 'Disabled'} agent tool permission: ${target.name}`,
      target: `Tool: ${target.id}`,
      severity: 'Info',
      details: 'Updated in Mock Agent Permission Matrix.',
    });
    showToast(`Tool "${target.name}" ${!target.enabled ? 'Enabled' : 'Disabled'} in Demo Runtime`, 'info');
  };

  const runSimulatedBacktest = (params: {
    strategyId: string;
    symbol: string;
    benchmark: string;
    startDate: string;
    endDate: string;
    initialCapital: number;
    commissionBps: number;
    slippageBps: number;
  }): BacktestExperiment => {
    const strat = strategies.find((s) => s.id === params.strategyId) || strategies[0];
    const exp = runDeterministicBacktest({
      ...params,
      strategyName: strat.name,
    });
    setBacktests((prev) => [exp, ...prev]);
    appendAuditLog({
      category: 'Agent Execution',
      actor: 'Quant Lab Simulator',
      action: `Executed simulated backtest ${exp.id} (${strat.name} on ${params.symbol})`,
      target: exp.id,
      severity: 'Info',
      details: `Total Return: ${exp.metrics.totalReturnPct}%, Sharpe: ${exp.metrics.sharpeRatio} (SIMULATED).`,
    });
    showToast(`Simulated Backtest ${exp.id} completed (${params.symbol})`, 'success');
    return exp;
  };

  const sendPlaygroundPrompt = (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed) return;
    const nowStr = '2026-11-02 ' + new Date().toTimeString().slice(0, 8) + ' UTC';
    const userMsg: PlaygroundMessage = {
      id: `MSG-U-${Date.now()}`,
      role: 'user',
      timestamp: nowStr,
      content: trimmed,
    };

    const lower = trimmed.toLowerCase();
    let responseMsg: PlaygroundMessage;

    if (lower.includes('现金流') || lower.includes('cash flow') || lower.includes('cashflow')) {
      responseMsg = {
        id: `MSG-A-${Date.now() + 1}`,
        role: 'orchestrator',
        timestamp: nowStr,
        content: 'SIMULATED MULTI-AGENT TRACE — Orchestrator routed your cash flow inquiry to Accounting Agent and Auditor Agent. Internal transfers ($15,000 USD across XFER-2026-881 and XFER-2026-742) were deterministically excluded from income/expense totals:',
        delegatedAgents: [
          {
            agentId: 'accounting',
            agentName: 'Accounting Agent',
            stepTitle: 'Compute Monthly Inflows, Outflows & Internal Transfer Exclusion',
            toolCalled: 'TransactionService.calculateCashFlowTotals(base="USD")',
            status: 'Completed (Simulated)',
            finding: 'October 2026 Inflows = $29,898.00 USD (Salary + Dividends + Interest). Outflows = $13,845.00 USD (Housing, Taxes, Infrastructure, Fees). Net Savings = +$16,053.00 USD (53.7% savings rate).',
          },
          {
            agentId: 'auditor',
            agentName: 'Auditor Agent',
            stepTitle: 'Verify Transfer Pair Integrity',
            toolCalled: 'LedgerService.verifyTransferLinks()',
            status: 'Completed (Simulated)',
            finding: 'Confirmed $10,000 (US Bank -> IBKR) and $5,000 (US Bank -> Schwab) are matched transfer pairs and did not inflate cash flow metrics.',
          },
        ],
        structuredMetrics: [
          { label: 'Oct Gross Inflow', value: '$29,898.00', delta: 'Salary + Div' },
          { label: 'Oct Total Outflow', value: '$13,845.00', delta: 'Incl. $4.2K Tax' },
          { label: 'Oct Net Cash Savings', value: '+$16,053.00', delta: '53.7% Rate' },
          { label: 'Excluded Internal Transfers', value: '$15,000.00', delta: '2 Matched Pairs' },
        ],
      };
    } else if (lower.includes('未匹配') || lower.includes('unmatched') || lower.includes('异常') || lower.includes('reconcil')) {
      responseMsg = {
        id: `MSG-A-${Date.now() + 1}`,
        role: 'orchestrator',
        timestamp: nowStr,
        content: 'SIMULATED MULTI-AGENT TRACE — Orchestrator dispatched Auditor Agent and Accounting Agent to inspect all 32 transactions across 6 accounts for unmatched or anomalous items:',
        delegatedAgents: [
          {
            agentId: 'auditor',
            agentName: 'Auditor Agent',
            stepTitle: 'Scan Ledger Status & Low-Confidence Queue',
            toolCalled: 'LedgerService.scanUnpostedAnomalies()',
            status: 'Completed (Simulated)',
            finding: 'Found 2 Pending Approval items (TX-2026-008 $1,480 Cloud Wire at 64% confidence; TX-2026-020 $640 OneMedical Diagnostic) and 1 Anomaly Flagged item (TX-2026-029 €45 Duplicate Custody Fee at Frankfurt Euro Bank).',
          },
          {
            agentId: 'accounting',
            agentName: 'Accounting Agent',
            stepTitle: 'Cross-Check Beancount Trial Balance',
            toolCalled: 'LedgerService.getTrialBalanceResidual()',
            status: 'Completed (Simulated)',
            finding: 'All Posted (*) Beancount entries sum to exactly 0.00 residual across USD, GBP, and EUR.',
          },
        ],
        structuredMetrics: [
          { label: 'Posted Entries', value: '29 / 32', delta: '100% Balanced' },
          { label: 'Pending Human Approval', value: '2 Items', delta: '$2,120.00 Total' },
          { label: 'Duplicate Fee Flagged', value: '1 Item', delta: '€45.00 EUR' },
          { label: 'Trial Balance Residual', value: '0.00 USD', delta: 'Verified' },
        ],
      };
    } else if (lower.includes('回撤') || lower.includes('drawdown') || lower.includes('risk') || lower.includes('比较') || lower.includes('配置')) {
      responseMsg = {
        id: `MSG-A-${Date.now() + 1}`,
        role: 'orchestrator',
        timestamp: nowStr,
        content: 'SIMULATED MULTI-AGENT TRACE — Orchestrator coordinated Risk Agent, Investment Agent, and Quant Agent to evaluate portfolio drawdown, volatility, and month-over-month allocation shift:',
        delegatedAgents: [
          {
            agentId: 'risk',
            agentName: 'Risk Agent',
            stepTitle: 'Compute Historical Max Drawdown & Volatility',
            toolCalled: 'RiskEngine.evaluateDrawdownAndBeta(window="12M")',
            status: 'Completed (Simulated)',
            finding: '12-Month Portfolio Max Drawdown is -4.82% (vs S&P 500 benchmark -6.40%). Annualized volatility is 11.4%, cushioned by $204,260.00 cash & $32,000 SGOV Treasury Bills.',
          },
          {
            agentId: 'investment',
            agentName: 'Investment Agent',
            stepTitle: 'Compare Current Allocation vs Prior Month',
            toolCalled: 'PortfolioService.compareAllocationMoM()',
            status: 'Completed (Simulated)',
            finding: 'US Equities + ETFs rose +1.4% MoM following NVDA and VOO additions; Non-USD currency exposure stands at 14.6% (GBP 4.9%, EUR 9.7%).',
          },
        ],
        structuredMetrics: [
          { label: '12M Max Drawdown (Sim)', value: '-4.82%', delta: 'vs -6.40% Bench' },
          { label: 'Annualized Volatility', value: '11.40%', delta: 'Sharpe 1.74' },
          { label: 'Cash + Short T-Bills', value: '$236,260.00', delta: '29.0% Liquidity' },
          { label: 'Non-USD FX Exposure', value: '14.60%', delta: 'GBP + EUR' },
        ],
      };
    } else {
      responseMsg = {
        id: `MSG-A-${Date.now() + 1}`,
        role: 'orchestrator',
        timestamp: nowStr,
        content: `SIMULATED MULTI-AGENT TRACE — Orchestrator analyzed "${trimmed}" using Investment Agent, Accounting Agent, and Risk Agent over your deterministic DEMO dataset:`,
        delegatedAgents: [
          {
            agentId: 'investment',
            agentName: 'Investment Agent',
            stepTitle: 'Inspect Multi-Institution Holdings & Cash Balances',
            toolCalled: 'PortfolioService.getWealthSummary(base="USD")',
            status: 'Completed (Simulated)',
            finding: 'Total Net Worth = $815,009.35 USD ($204,260.00 Cash + $616,572.00 Investments - $5,822.65 Liabilities across 6 accounts).',
          },
          {
            agentId: 'risk',
            agentName: 'Risk Agent',
            stepTitle: 'Check Concentration & Governance Guardrails',
            toolCalled: 'RiskEngine.runComplianceAudit()',
            status: 'Completed (Simulated)',
            finding: 'NVDA ($79,800 / 12.94%) and IT Sector (43.82%) are flagged in Approval Inbox for optional rebalancing review. Read-only mode strictly enforced.',
          },
        ],
        structuredMetrics: [
          { label: 'Total Net Worth (USD)', value: '$815,009.35', delta: 'SIMULATED' },
          { label: 'Total Investments', value: '$616,572.00', delta: '17 Holdings' },
          { label: 'Total Cash Reserves', value: '$204,260.00', delta: 'USD/GBP/EUR' },
          { label: 'Active Approval Tasks', value: `${approvalTasks.filter((t) => t.status === 'Pending').length} Pending`, delta: 'Human-in-Loop' },
        ],
      };
    }

    setPlaygroundMessages((prev) => [...prev, userMsg, responseMsg]);
    setAgentLogs((prev) => [
      {
        id: `ALOG-${31 + prev.length}`,
        timestamp: nowStr,
        agentId: 'orchestrator',
        agentName: 'Orchestrator Agent',
        trigger: 'User Prompt',
        taskSummary: `Processed Playground query: "${trimmed.slice(0, 60)}"`,
        toolsInvoked: ['Read Accounts', 'Read Holdings', 'Calculate Returns'],
        durationMs: 620,
        tokensUsed: 1180,
        status: 'Success (Simulated)',
        outputPreview: responseMsg.content.slice(0, 110) + '...',
      },
      ...prev,
    ]);
    appendAuditLog({
      category: 'Agent Execution',
      actor: 'Orchestrator Agent (Mock Runtime)',
      action: `Executed multi-agent query: "${trimmed.slice(0, 48)}"`,
      target: 'Agent Playground',
      severity: 'Info',
      details: 'Simulated Pydantic AI workflow trace completed with deterministic math.',
    });
  };

  const decideApprovalTask = (taskId: string, decision: 'Approved' | 'Rejected', editedPayload?: string) => {
    const target = approvalTasks.find((t) => t.id === taskId);
    if (!target) return;

    setApprovalTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: decision,
              rawPayload: editedPayload !== undefined ? editedPayload : t.rawPayload,
            }
          : t
      )
    );

    // If linked to a pending transaction/journal entry, update its mock status too
    if (taskId === 'APR-2026-001') {
      setTransactions((prev) =>
        prev.map((tx) =>
          tx.id === 'TX-2026-008'
            ? { ...tx, ledgerStatus: decision === 'Approved' ? 'Posted' : 'Unposted', status: 'Settled' }
            : tx
        )
      );
      setJournalEntries((prev) =>
        prev.map((je) =>
          je.id === 'JE-2026-007'
            ? { ...je, status: decision === 'Approved' ? 'Posted' : 'Rejected', flag: decision === 'Approved' ? '*' : '!' }
            : je
        )
      );
    } else if (taskId === 'APR-2026-002') {
      setTransactions((prev) =>
        prev.map((tx) =>
          tx.id === 'TX-2026-020'
            ? { ...tx, ledgerStatus: decision === 'Approved' ? 'Posted' : 'Unposted' }
            : tx
        )
      );
      setJournalEntries((prev) =>
        prev.map((je) =>
          je.id === 'JE-2026-009'
            ? { ...je, status: decision === 'Approved' ? 'Posted' : 'Rejected', flag: decision === 'Approved' ? '*' : '!' }
            : je
        )
      );
    }

    appendAuditLog({
      category: 'Approval Decision',
      actor: 'Local Workstation Operator',
      action: `${decision} approval task ${taskId}: ${target.title}`,
      target: taskId,
      severity: decision === 'Rejected' ? 'Warning' : 'Info',
      details: `Human-in-the-loop decision recorded in Demo State (${decision}).`,
    });

    showToast(`Task ${taskId} marked as ${decision} (Simulated Demo State)`, decision === 'Approved' ? 'success' : 'warning');
  };

  const approveJournalDraft = (entryId: string) => {
    const entry = journalEntries.find((j) => j.id === entryId);
    if (!entry) return;
    setJournalEntries((prev) =>
      prev.map((j) => (j.id === entryId ? { ...j, status: 'Posted', flag: '*' } : j))
    );
    if (entry.transactionId) {
      setTransactions((prev) =>
        prev.map((tx) => (tx.id === entry.transactionId ? { ...tx, ledgerStatus: 'Posted', status: 'Settled' } : tx))
      );
    }
    appendAuditLog({
      category: 'Ledger Change',
      actor: 'Local Workstation Operator',
      action: `Approved & posted Beancount draft ${entryId}`,
      target: entryId,
      severity: 'Info',
      details: 'Simulated posting in memory; no external disk file modified.',
    });
    showToast(`Beancount entry ${entryId} approved & posted (Simulated)`, 'success');
  };

  const rejectJournalDraft = (entryId: string) => {
    setJournalEntries((prev) =>
      prev.map((j) => (j.id === entryId ? { ...j, status: 'Rejected' } : j))
    );
    appendAuditLog({
      category: 'Ledger Change',
      actor: 'Local Workstation Operator',
      action: `Rejected Beancount draft ${entryId}`,
      target: entryId,
      severity: 'Warning',
      details: 'Draft rejected in Demo State.',
    });
    showToast(`Beancount entry ${entryId} rejected (Simulated)`, 'warning');
  };

  return (
    <OFinanceContext.Provider
      value={{
        baseCurrency,
        setBaseCurrency,
        settings,
        updateSettings,
        globalSearchQuery,
        setGlobalSearchQuery,
        toastMessage,
        showToast,
        accounts,
        connectors,
        holdings,
        transactions,
        journalEntries,
        wealthSummary,
        netWorthHistory: NET_WORTH_HISTORY_12M,
        cashFlowHistory: CASH_FLOW_12M,
        watchlist,
        researchReports,
        economicCalendar,
        strategies,
        backtests,
        runSimulatedBacktest,
        agents,
        aiModels,
        toolPermissions,
        agentLogs,
        playgroundMessages,
        approvalTasks,
        auditLogs,
        isSyncing,
        lastGlobalSync,
        syncHistory,
        failedSyncQueue,
        triggerSimulatedSync,
        retryFailedSync,
        toggleConnectorState,
        assignAgentModel,
        toggleToolPermission,
        sendPlaygroundPrompt,
        decideApprovalTask,
        approveJournalDraft,
        rejectJournalDraft,
        appendAuditLog,
      }}
    >
      {children}
    </OFinanceContext.Provider>
  );
};

export function useOFinance(): OFinanceContextValue {
  const ctx = useContext(OFinanceContext);
  if (!ctx) {
    throw new Error('useOFinance must be used within an OFinanceProvider');
  }
  return ctx;
}
