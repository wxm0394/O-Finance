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
  AssistantTaskMode,
  TaskModeProfile,
  UnifiedModelConfig,
  ModelProviderPreset,
  AgentToolPermission,
  AgentExecutionLog,
  PlaygroundMessage,
  ApprovalTask,
  AuditLogEntry,
  MarketWatchItem,
  ResearchReportItem,
  EconomicCalendarEvent,
  SystemSettingsState,
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
  OFINANCE_ASSISTANT_STATUS,
  TASK_MODE_PROFILES,
  INITIAL_UNIFIED_MODEL_CONFIG,
  MODEL_PROVIDER_PRESETS,
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

  // Single Assistant (`OFinanceAssistant`), Approvals & Audit
  assistantStatus: typeof OFINANCE_ASSISTANT_STATUS;
  taskModeProfiles: TaskModeProfile[];
  selectedTaskMode: AssistantTaskMode;
  setSelectedTaskMode: (mode: AssistantTaskMode) => void;
  unifiedModelConfig: UnifiedModelConfig;
  modelPresets: ModelProviderPreset[];
  updateUnifiedModelConfig: (partial: Partial<UnifiedModelConfig>) => void;
  applyModelPreset: (presetId: string) => void;
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
  toggleToolPermission: (toolId: string) => void;
  sendPlaygroundPrompt: (promptText: string, modeOverride?: AssistantTaskMode) => void;
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

  const [assistantStatus, setAssistantStatus] = useState(OFINANCE_ASSISTANT_STATUS);
  const [selectedTaskMode, setSelectedTaskMode] = useState<AssistantTaskMode>('Risk Analysis');
  const [unifiedModelConfig, setUnifiedModelConfig] = useState<UnifiedModelConfig>(INITIAL_UNIFIED_MODEL_CONFIG);
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
    if (partial.agentDailyBudgetUSD !== undefined) {
      setUnifiedModelConfig((prev) => ({
        ...prev,
        daily_budget_usd: partial.agentDailyBudgetUSD!,
      }));
    }
    appendAuditLog({
      category: 'Auth Event',
      actor: 'Local Workstation Operator',
      action: `Updated system settings (${Object.keys(partial).join(', ')})`,
      target: 'Local Demo Configuration',
      severity: 'Info',
      details: 'Saved to local browser storage (VITE_DEMO_MODE=true). Zero API keys stored.',
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

  const updateUnifiedModelConfig = (partial: Partial<UnifiedModelConfig>) => {
    setUnifiedModelConfig((prev) => ({ ...prev, ...partial }));
    if (partial.daily_budget_usd !== undefined) {
      setSettings((prev) => ({ ...prev, agentDailyBudgetUSD: partial.daily_budget_usd! }));
    }
    appendAuditLog({
      category: 'Agent Execution',
      actor: 'Local Workstation Operator',
      action: `Updated unified model configuration (${Object.keys(partial).join(', ')})`,
      target: 'OFinanceAssistant Global Config',
      severity: 'Info',
      details: 'Shared Pydantic AI runtime config updated in Demo state. API key remains in backend vault.',
    });
    showToast('Unified Model Configuration updated for OFinanceAssistant (Simulated Runtime)', 'success');
  };

  const applyModelPreset = (presetId: string) => {
    const preset = MODEL_PROVIDER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setUnifiedModelConfig((prev) => ({
      ...prev,
      provider: preset.provider,
      model: preset.model,
      base_url: preset.base_url,
      model_status: preset.model_status,
      api_key_configured: true,
    }));
    appendAuditLog({
      category: 'Agent Execution',
      actor: 'Local Workstation Operator',
      action: `Switched global OFinanceAssistant model to ${preset.provider} (${preset.model})`,
      target: 'OFinanceAssistant Global Config',
      severity: 'Info',
      details: 'All 6 task modes now share this unified LLM provider configuration.',
    });
    showToast(`OFinanceAssistant global model set to ${preset.provider} · ${preset.model}`, 'success');
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
      action: `${!target.enabled ? 'Enabled' : 'Disabled'} assistant tool permission: ${target.name}`,
      target: `Tool: ${target.id}`,
      severity: 'Info',
      details: 'Updated in Unified Tool Registry for OFinanceAssistant.',
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

  const sendPlaygroundPrompt = (promptText: string, modeOverride?: AssistantTaskMode) => {
    const trimmed = promptText.trim();
    if (!trimmed) return;
    const nowStr = '2026-11-02 ' + new Date().toTimeString().slice(0, 8) + ' UTC';
    const lower = trimmed.toLowerCase();

    // Determine effective task mode based on explicit selection or query intent
    let activeMode: AssistantTaskMode = modeOverride || selectedTaskMode;
    if (!modeOverride) {
      if (lower.includes('现金流') || lower.includes('cash flow') || lower.includes('cashflow') || lower.includes('journal') || lower.includes('beancount')) {
        activeMode = 'Accounting';
      } else if (lower.includes('未匹配') || lower.includes('unmatched') || lower.includes('异常') || lower.includes('reconcil') || lower.includes('audit')) {
        activeMode = 'Audit';
      } else if (lower.includes('回撤') || lower.includes('drawdown') || lower.includes('risk') || lower.includes('concentration')) {
        activeMode = 'Risk Analysis';
      } else if (lower.includes('backtest') || lower.includes('sharpe') || lower.includes('quant') || lower.includes('strategy')) {
        activeMode = 'Quantitative Research';
      } else if (lower.includes('research') || lower.includes('asml') || lower.includes('macro') || lower.includes('earnings')) {
        activeMode = 'Research';
      } else if (lower.includes('比较') || lower.includes('配置') || lower.includes('allocation') || lower.includes('portfolio')) {
        activeMode = 'Portfolio Analysis';
      }
    }
    setSelectedTaskMode(activeMode);

    const userMsg: PlaygroundMessage = {
      id: `MSG-U-${Date.now()}`,
      role: 'user',
      timestamp: nowStr,
      taskMode: activeMode,
      content: trimmed,
    };

    let responseMsg: PlaygroundMessage;

    if (activeMode === 'Accounting' || lower.includes('现金流') || lower.includes('cash flow') || lower.includes('cashflow')) {
      responseMsg = {
        id: `MSG-A-${Date.now() + 1}`,
        role: 'assistant',
        timestamp: nowStr,
        taskMode: 'Accounting',
        content:
          'SIMULATED SINGLE-ASSISTANT TRACE — OFinanceAssistant (Accounting Mode) executed 4 deterministic tool steps. Internal cross-account transfers ($15,000 USD across XFER-2026-881 and XFER-2026-742) were deterministically excluded from income/expense cash flows:',
        toolTimeline: [
          {
            stepNumber: 1,
            toolName: 'Read Transactions',
            category: 'Read-Only',
            callSignature: 'read_transactions(window="2026-10", include_transfer_links=True)',
            status: 'Completed (Simulated)',
            deterministicFinding: 'Loaded 32 normalized transactions across 6 accounts; identified 2 linked internal transfer pairs.',
            durationMs: 110,
          },
          {
            stepNumber: 2,
            toolName: 'Calculate Cash Flow',
            category: 'Deterministic Computation',
            callSignature: 'calculate_cash_flow(base_currency="USD", exclude_internal_transfers=True)',
            status: 'Completed (Simulated)',
            deterministicFinding:
              'October 2026 Inflows = $29,898.00 USD; Outflows = $13,845.00 USD; Net Savings = +$16,053.00 USD (53.7% savings rate).',
            durationMs: 165,
          },
          {
            stepNumber: 3,
            toolName: 'Verify Double-Entry Balance',
            category: 'Deterministic Computation',
            callSignature: 'verify_double_entry_balance(ledger="main.beancount")',
            status: 'Completed (Simulated)',
            deterministicFinding:
              'Confirmed XFER-2026-881 ($10,000 US Bank -> IBKR) and XFER-2026-742 ($5,000 US Bank -> Schwab) sum to 0.00 USD residual.',
            durationMs: 140,
          },
          {
            stepNumber: 4,
            toolName: 'Generate Journal Draft',
            category: 'Drafting',
            callSignature: 'generate_journal_draft(output_schema="AccountingDraftResult")',
            status: 'Completed (Simulated)',
            deterministicFinding: 'Verified 29 posted entries and 2 pending low-confidence drafts awaiting human approval.',
            durationMs: 175,
          },
        ],
        structuredMetrics: [
          { label: 'Oct Gross Inflow', value: '$29,898.00', delta: 'Salary + Div' },
          { label: 'Oct Total Outflow', value: '$13,845.00', delta: 'Incl. $4.2K Tax' },
          { label: 'Oct Net Cash Savings', value: '+$16,053.00', delta: '53.7% Rate' },
          { label: 'Excluded Internal Transfers', value: '$15,000.00', delta: '2 Matched Pairs' },
        ],
      };
    } else if (activeMode === 'Audit' || lower.includes('未匹配') || lower.includes('unmatched') || lower.includes('异常') || lower.includes('reconcil')) {
      responseMsg = {
        id: `MSG-A-${Date.now() + 1}`,
        role: 'assistant',
        timestamp: nowStr,
        taskMode: 'Audit',
        content:
          'SIMULATED SINGLE-ASSISTANT TRACE — OFinanceAssistant (Audit Mode) inspected all 32 transactions and 9 Beancount journal entries using deterministic verification tools:',
        toolTimeline: [
          {
            stepNumber: 1,
            toolName: 'Read Transactions',
            category: 'Read-Only',
            callSignature: 'read_transactions(status_filter=["Pending Approval", "Anomaly Flagged"])',
            status: 'Completed (Simulated)',
            deterministicFinding:
              'Identified 2 Pending Approval items (TX-2026-008 $1,480 Cloud Wire at 64% confidence; TX-2026-020 $640 OneMedical Diagnostic) and 1 Anomaly Flagged item (TX-2026-029 €45 Duplicate Custody Fee).',
            durationMs: 115,
          },
          {
            stepNumber: 2,
            toolName: 'Read Beancount Ledger',
            category: 'Read-Only',
            callSignature: 'read_beancount_ledger(path="~/o-finance/ledger/main.beancount")',
            status: 'Completed (Simulated)',
            deterministicFinding: 'Loaded 5 root account classes and 19 trial balance rows.',
            durationMs: 130,
          },
          {
            stepNumber: 3,
            toolName: 'Verify Double-Entry Balance',
            category: 'Deterministic Computation',
            callSignature: 'verify_double_entry_balance(strict_zero_residual=True)',
            status: 'Completed (Simulated)',
            deterministicFinding: 'All Posted (*) Beancount entries balance to exactly 0.00 USD residual ($950,317.00 Debit == $950,317.00 Credit).',
            durationMs: 145,
          },
          {
            stepNumber: 4,
            toolName: 'Request Human Approval',
            category: 'Governance',
            callSignature: 'request_human_approval(tasks=["APR-2026-001", "APR-2026-004", "APR-2026-005"])',
            status: 'Completed (Simulated)',
            deterministicFinding: 'Confirmed anomalous custody fee and stale PSD2 consent remain queued in Approval Inbox.',
            durationMs: 95,
          },
        ],
        structuredMetrics: [
          { label: 'Posted Entries', value: '29 / 32', delta: '100% Balanced' },
          { label: 'Pending Human Approval', value: '2 Items', delta: '$2,120.00 Total' },
          { label: 'Duplicate Fee Flagged', value: '1 Item', delta: '€45.00 EUR' },
          { label: 'Trial Balance Residual', value: '0.00 USD', delta: 'Verified' },
        ],
      };
    } else if (activeMode === 'Portfolio Analysis' || lower.includes('比较') || lower.includes('配置') || lower.includes('allocation')) {
      responseMsg = {
        id: `MSG-A-${Date.now() + 1}`,
        role: 'assistant',
        timestamp: nowStr,
        taskMode: 'Portfolio Analysis',
        content:
          'SIMULATED SINGLE-ASSISTANT TRACE — OFinanceAssistant (Portfolio Analysis Mode) aggregated holdings across all 4 investment accounts and calculated deterministic returns and FX exposure:',
        toolTimeline: [
          {
            stepNumber: 1,
            toolName: 'Read Holdings',
            category: 'Read-Only',
            callSignature: 'read_holdings(include_cost_basis=True)',
            status: 'Completed (Simulated)',
            deterministicFinding: 'Aggregated 17 positions across IBKR ($312.5K), Schwab ($198.7K), Firstrade ($74.3K), and EU Depot (€28.5K).',
            durationMs: 125,
          },
          {
            stepNumber: 2,
            toolName: 'Calculate FX',
            category: 'Deterministic Computation',
            callSignature: 'calculate_fx(base="USD", rates={"GBP": 1.2850, "EUR": 1.0920})',
            status: 'Completed (Simulated)',
            deterministicFinding: 'Currency exposure stands at 85.4% USD, 4.9% GBP, and 9.7% EUR (14.6% non-USD total).',
            durationMs: 95,
          },
          {
            stepNumber: 3,
            toolName: 'Calculate Portfolio Returns',
            category: 'Deterministic Computation',
            callSignature: 'calculate_portfolio_returns(window="YTD")',
            status: 'Completed (Simulated)',
            deterministicFinding: 'Total Investments = $616,572.00 USD; Unrealized P&L = +$95,971.60 (+18.43%); YTD Dividends = $5,340.24.',
            durationMs: 170,
          },
          {
            stepNumber: 4,
            toolName: 'Generate Investment Analysis',
            category: 'Drafting',
            callSignature: 'generate_investment_analysis(schema="PortfolioAnalysisResult")',
            status: 'Completed (Simulated)',
            deterministicFinding: 'US Equities & ETFs increased +1.4% MoM following NVDA and VOO additions.',
            durationMs: 160,
          },
        ],
        structuredMetrics: [
          { label: 'Total Investments (USD)', value: '$616,572.00', delta: '+18.43% Unrlz' },
          { label: 'YTD Realized + Div', value: '+$13,290.24', delta: '$5,340 Div' },
          { label: 'Cash + Short T-Bills', value: '$236,260.00', delta: '29.0% Liquidity' },
          { label: 'Non-USD FX Exposure', value: '14.60%', delta: 'GBP + EUR' },
        ],
      };
    } else if (activeMode === 'Quantitative Research') {
      responseMsg = {
        id: `MSG-A-${Date.now() + 1}`,
        role: 'assistant',
        timestamp: nowStr,
        taskMode: 'Quantitative Research',
        content:
          'SIMULATED SINGLE-ASSISTANT TRACE — OFinanceAssistant (Quantitative Research Mode) queried the local DuckDB/Parquet backtest store and evaluated strategy risk-adjusted metrics:',
        toolTimeline: [
          {
            stepNumber: 1,
            toolName: 'Read Market Data',
            category: 'Read-Only',
            callSignature: 'read_market_data(universe=["SPY", "QQQ", "NVDA", "VWRA"])',
            status: 'Completed (Simulated)',
            deterministicFinding: 'Verified 12-month daily OHLCV series in simulated DuckDB Parquet store.',
            durationMs: 105,
          },
          {
            stepNumber: 2,
            toolName: 'Run DuckDB Backtest',
            category: 'Deterministic Computation',
            callSignature: 'run_duckdb_backtest(strategy="strat-ma-cross", comm_bps=5, slip_bps=2)',
            status: 'Completed (Simulated)',
            deterministicFinding: '50/200 Dual EMA on SPY achieved +21.95% total return vs +9.60% benchmark.',
            durationMs: 260,
          },
          {
            stepNumber: 3,
            toolName: 'Calculate Risk Metrics',
            category: 'Deterministic Computation',
            callSignature: 'calculate_risk_metrics(experiment_id="EXP-901010")',
            status: 'Completed (Simulated)',
            deterministicFinding: 'Sharpe Ratio = 1.78, Sortino Ratio = 2.46, Max Drawdown = -1.59%, Win Rate = 75.0%.',
            durationMs: 130,
          },
        ],
        structuredMetrics: [
          { label: 'Strategy Return (Sim)', value: '+21.95%', delta: 'vs +9.60% SPY' },
          { label: 'Sharpe / Sortino', value: '1.78 / 2.46', delta: 'Net of 7bps Cost' },
          { label: 'Max Drawdown', value: '-1.59%', delta: 'Unlevered 1.0x' },
          { label: 'Active Experiments', value: `${backtests.length} Runs`, delta: 'DuckDB Sim' },
        ],
      };
    } else if (activeMode === 'Research') {
      responseMsg = {
        id: `MSG-A-${Date.now() + 1}`,
        role: 'assistant',
        timestamp: nowStr,
        taskMode: 'Research',
        content:
          'SIMULATED SINGLE-ASSISTANT TRACE — OFinanceAssistant (Research Mode) synthesized semiconductor supply-chain metrics and checked the independent external Daily Analysis Connector:',
        toolTimeline: [
          {
            stepNumber: 1,
            toolName: 'Read Holdings',
            category: 'Read-Only',
            callSignature: 'read_holdings(sector="Information Technology")',
            status: 'Completed (Simulated)',
            deterministicFinding: 'Found 6 technology & semiconductor positions (NVDA, MSFT, AAPL, ASML, TSM, SAP.DE) totaling $270,121.00 USD.',
            durationMs: 110,
          },
          {
            stepNumber: 2,
            toolName: 'Read External Research Reports',
            category: 'Read-Only',
            callSignature: 'read_external_research_reports(connector="daily_stock_analysis")',
            status: 'Completed (Simulated)',
            deterministicFinding: 'External connector status: Not Connected (Read-Only boundary enforced). Loaded 4 internal research briefings.',
            durationMs: 120,
          },
          {
            stepNumber: 3,
            toolName: 'Generate Research Report',
            category: 'Drafting',
            callSignature: 'generate_research_report(schema="ResearchBriefingResult")',
            status: 'Completed (Simulated)',
            deterministicFinding: 'Compiled Semiconductor CapEx & G3 Yield Curve synthesis.',
            durationMs: 240,
          },
        ],
        structuredMetrics: [
          { label: 'Tech & Semi Exposure', value: '$270,121.00', delta: '43.82% Weight' },
          { label: 'Research Briefings', value: '4 Reports', delta: 'REP-2026-101..104' },
          { label: 'External Connector', value: 'Not Connected', delta: 'Read-Only API' },
          { label: 'Token Cost (Sim)', value: '$0.03 USD', delta: 'Within $0.75 Cap' },
        ],
      };
    } else {
      responseMsg = {
        id: `MSG-A-${Date.now() + 1}`,
        role: 'assistant',
        timestamp: nowStr,
        taskMode: activeMode,
        content: `SIMULATED SINGLE-ASSISTANT TRACE — OFinanceAssistant (${activeMode} Mode) analyzed "${trimmed}" using sequential deterministic tool invocations over your DEMO dataset:`,
        toolTimeline: [
          {
            stepNumber: 1,
            toolName: 'Read Accounts',
            category: 'Read-Only',
            callSignature: 'read_accounts(include_balances=True)',
            status: 'Completed (Simulated)',
            deterministicFinding:
              'Total Net Worth = $815,009.35 USD ($204,260.00 Cash + $616,572.00 Investments - $5,822.65 Liabilities across 6 accounts).',
            durationMs: 115,
          },
          {
            stepNumber: 2,
            toolName: 'Calculate Risk Metrics',
            category: 'Deterministic Computation',
            callSignature: 'calculate_risk_metrics(window="12M")',
            status: 'Completed (Simulated)',
            deterministicFinding:
              '12M Max Drawdown is -4.82% (vs -6.40% benchmark). NVDA (12.94%) and IT Sector (43.82%) exceed policy caps.',
            durationMs: 175,
          },
          {
            stepNumber: 3,
            toolName: 'Record Audit Event',
            category: 'Governance',
            callSignature: 'record_audit_event(actor="OFinanceAssistant", mode="' + activeMode + '")',
            status: 'Completed (Simulated)',
            deterministicFinding: 'Logged deterministic verification hash to append-only audit trail. Read-only mode strictly enforced.',
            durationMs: 85,
          },
        ],
        structuredMetrics: [
          { label: 'Total Net Worth (USD)', value: '$815,009.35', delta: 'SIMULATED' },
          { label: 'Total Investments', value: '$616,572.00', delta: '17 Holdings' },
          { label: '12M Max Drawdown', value: '-4.82%', delta: 'Sharpe 1.74' },
          { label: 'Active Approval Tasks', value: `${approvalTasks.filter((t) => t.status === 'Pending').length} Pending`, delta: 'Human-in-Loop' },
        ],
      };
    }

    setPlaygroundMessages((prev) => [...prev, userMsg, responseMsg]);
    setAssistantStatus((prev) => ({
      ...prev,
      lastExecution: nowStr,
      tokensUsedToday: prev.tokensUsedToday + 1180,
      budgetUsedTodayUSD: Number((prev.budgetUsedTodayUSD + 0.03).toFixed(2)),
      tasksExecutedToday: prev.tasksExecutedToday + 1,
    }));
    setAgentLogs((prev) => [
      {
        id: `ALOG-${31 + prev.length}`,
        timestamp: nowStr,
        assistantName: 'OFinanceAssistant',
        taskMode: activeMode,
        trigger: 'User Prompt',
        taskSummary: `Executed [${activeMode}] query: "${trimmed.slice(0, 56)}"`,
        toolsInvoked: responseMsg.toolTimeline ? responseMsg.toolTimeline.map((s) => s.toolName) : ['Read Accounts'],
        durationMs: 580,
        tokensUsed: 1180,
        estimatedCostUSD: 0.03,
        status: 'Success (Simulated)',
        outputPreview: responseMsg.content.slice(0, 110) + '...',
      },
      ...prev,
    ]);
    appendAuditLog({
      category: 'Agent Execution',
      actor: `OFinanceAssistant [${activeMode} Mode]`,
      action: `Executed single-assistant query: "${trimmed.slice(0, 48)}"`,
      target: 'AI Assistant Center Playground',
      severity: 'Info',
      details: 'Simulated Pydantic AI sequential tool trace completed with deterministic math.',
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
        assistantStatus,
        taskModeProfiles: TASK_MODE_PROFILES,
        selectedTaskMode,
        setSelectedTaskMode,
        unifiedModelConfig,
        modelPresets: MODEL_PROVIDER_PRESETS,
        updateUnifiedModelConfig,
        applyModelPreset,
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
