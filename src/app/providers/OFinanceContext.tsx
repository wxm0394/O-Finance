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
  AssistantToolPermission,
  AssistantTaskLog,
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
  INITIAL_ASSISTANT_TASK_LOGS,
  INITIAL_PLAYGROUND_MESSAGES,
} from '../../mocks/assistant';
import { INITIAL_APPROVAL_TASKS, INITIAL_AUDIT_LOGS } from '../../mocks/audit';
import {
  calculateWealthSummary,
  AggregatedWealthSummary,
  runDeterministicBacktest,
} from '../../utils/finance';
import { AssistantService, ApprovalService } from '../../services';
import { ApiClient } from '../../services/api/client';

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
  toolPermissions: AssistantToolPermission[];
  assistantTaskLogs: AssistantTaskLog[];
  playgroundMessages: PlaygroundMessage[];
  isAssistantRunning: boolean;
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
  sendPlaygroundPrompt: (promptText: string, modeOverride?: AssistantTaskMode) => Promise<void>;
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
  assistantDailyBudgetUSD: 25.0,
  assistantMaxStepsPerRun: 8,
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
  const [toolPermissions, setToolPermissions] = useState<AssistantToolPermission[]>(INITIAL_TOOL_PERMISSIONS);
  const [assistantTaskLogs, setAssistantTaskLogs] = useState<AssistantTaskLog[]>(INITIAL_ASSISTANT_TASK_LOGS);
  const [playgroundMessages, setPlaygroundMessages] = useState<PlaygroundMessage[]>(INITIAL_PLAYGROUND_MESSAGES);
  const [isAssistantRunning, setIsAssistantRunning] = useState(false);
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
    if (partial.assistantDailyBudgetUSD !== undefined) {
      setUnifiedModelConfig((prev) => ({
        ...prev,
        daily_budget_usd: partial.assistantDailyBudgetUSD!,
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

  /**
   * Update Unified Model Configuration:
   * - Never sets `api_key_configured: true` from frontend interactions.
   * - In Demo Mode, `api_key_configured` remains `false` (unverified).
   */
  const updateUnifiedModelConfig = (partial: Partial<UnifiedModelConfig>) => {
    setUnifiedModelConfig((prev) => {
      const nextProvider = partial.provider || prev.provider;
      const isOllama = nextProvider === 'Local Ollama';
      return {
        ...prev,
        ...partial,
        api_key_configured: ApiClient.isDemoMode ? false : prev.api_key_configured,
        api_key_status: ApiClient.isDemoMode
          ? isOllama
            ? 'Not Required (Local Ollama — Unverified Host)'
            : 'Simulated / Unknown (Unverified in Demo Mode)'
          : prev.api_key_status,
        model_status: ApiClient.isDemoMode
          ? isOllama
            ? 'Local Offline Standby (Unverified)'
            : 'Simulated / Unknown (Demo Mode)'
          : prev.model_status,
      };
    });
    if (partial.daily_budget_usd !== undefined) {
      setSettings((prev) => ({ ...prev, assistantDailyBudgetUSD: partial.daily_budget_usd! }));
    }
    appendAuditLog({
      category: 'Assistant Execution',
      actor: 'Local Workstation Operator',
      action: `Updated unified model configuration (${Object.keys(partial).join(', ')})`,
      target: 'OFinanceAssistant Global Config',
      severity: 'Info',
      details: 'Model parameters updated. API key status remains unverified in Demo Mode until FastAPI backend check.',
    });
    showToast('Unified Model Configuration updated (API Key status requires FastAPI backend verification)', 'info');
  };

  /**
   * Apply a model preset:
   * - Strictly updates ONLY `provider`, `model`, and `base_url` (plus unverified status labels in Demo Mode).
   * - NEVER sets `api_key_configured: true`!
   */
  const applyModelPreset = (presetId: string) => {
    const preset = MODEL_PROVIDER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const isOllama = preset.provider === 'Local Ollama';
    setUnifiedModelConfig((prev) => ({
      ...prev,
      provider: preset.provider,
      model: preset.model,
      base_url: preset.base_url,
      api_key_configured: false,
      api_key_status: isOllama
        ? 'Not Required (Local Ollama — Unverified Host)'
        : 'Simulated / Unknown (Unverified in Demo Mode)',
      model_status: isOllama
        ? 'Local Offline Standby (Unverified)'
        : 'Simulated / Unknown (Demo Mode)',
    }));
    appendAuditLog({
      category: 'Assistant Execution',
      actor: 'Local Workstation Operator',
      action: `Switched global OFinanceAssistant model to ${preset.provider} (${preset.model})`,
      target: 'OFinanceAssistant Global Config',
      severity: 'Info',
      details: 'Changed provider, model, and base_url only. Credential verification deferred to FastAPI backend.',
    });
    showToast(
      `Model set to ${preset.provider} · ${preset.model} (Key status: Unverified in Demo Mode)`,
      'info'
    );
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
      category: 'Assistant Execution',
      actor: 'Quant Lab Simulator',
      action: `Executed simulated backtest ${exp.id} (${strat.name} on ${params.symbol})`,
      target: exp.id,
      severity: 'Info',
      details: `Total Return: ${exp.metrics.totalReturnPct}%, Sharpe: ${exp.metrics.sharpeRatio} (SIMULATED).`,
    });
    showToast(`Simulated Backtest ${exp.id} completed (${params.symbol})`, 'success');
    return exp;
  };

  /**
   * Dual-Mode `sendPlaygroundPrompt`:
   * - Always delegates to `AssistantService.runTask(payload, demoSnapshotContext)`.
   * - In `LOCAL_FASTAPI` mode (`VITE_DEMO_MODE=false`), `AssistantService.runTask` calls `POST /api/v1/assistant/run`
   *   on the local FastAPI + Pydantic AI + Gemini backend.
   * - In `DEMO` mode (`VITE_DEMO_MODE=true`), `AssistantService.runTask` executes the Deterministic Demo Adapter
   *   over live financial state and never fabricates real LLM token usage or real USD charges.
   */
  const sendPlaygroundPrompt = async (promptText: string, modeOverride?: AssistantTaskMode) => {
    const trimmed = promptText.trim();
    if (!trimmed || isAssistantRunning) return;

    const activeMode: AssistantTaskMode = modeOverride || selectedTaskMode;
    if (modeOverride && modeOverride !== selectedTaskMode) {
      setSelectedTaskMode(modeOverride);
    }

    const profile =
      TASK_MODE_PROFILES.find((p) => p.mode === activeMode) || TASK_MODE_PROFILES[0];

    const nowStr = '2026-11-02 ' + new Date().toTimeString().slice(0, 8) + ' UTC';
    const userMsg: PlaygroundMessage = {
      id: `MSG-U-${Date.now()}`,
      role: 'user',
      timestamp: nowStr,
      taskMode: activeMode,
      executionOrigin: ApiClient.isDemoMode ? 'DEMO_ADAPTER' : 'LOCAL_FASTAPI_GEMINI',
      content: trimmed,
    };

    setPlaygroundMessages((prev) => [...prev, userMsg]);
    setIsAssistantRunning(true);

    try {
      const result = await AssistantService.runTask(
        {
          task_mode: activeMode,
          user_input: trimmed,
          permitted_data_scope: profile.permittedDataScope,
          output_format: profile.expectedOutputSchema,
          approval_policy: profile.approvalPolicy,
        },
        {
          baseCurrency,
          accounts,
          holdings,
          transactions,
          journalEntries,
          approvalTasks,
          backtests,
        }
      );

      const responseMsg: PlaygroundMessage = {
        id: `MSG-A-${Date.now()}`,
        role: 'assistant',
        timestamp: result.timestamp,
        taskMode: result.task_mode,
        executionOrigin: result.execution_origin,
        content: result.content,
        toolTimeline: result.tool_timeline,
        structuredMetrics: result.structured_metrics,
      };

      setPlaygroundMessages((prev) => [...prev, responseMsg]);
      setAssistantTaskLogs((prev) => [result.task_log, ...prev]);
      setAssistantStatus((prev) => ({
        ...prev,
        lastExecution: result.timestamp,
        simulatedTasksExecutedToday:
          result.execution_origin === 'DEMO_ADAPTER'
            ? prev.simulatedTasksExecutedToday + 1
            : prev.simulatedTasksExecutedToday,
        realTokensUsedToday:
          result.execution_origin === 'LOCAL_FASTAPI_GEMINI' && result.task_log.tokensUsed
            ? prev.realTokensUsedToday + result.task_log.tokensUsed
            : prev.realTokensUsedToday,
        realBudgetUsedTodayUSD:
          result.execution_origin === 'LOCAL_FASTAPI_GEMINI' && result.task_log.estimatedCostUSD
            ? Number((prev.realBudgetUsedTodayUSD + result.task_log.estimatedCostUSD).toFixed(4))
            : prev.realBudgetUsedTodayUSD,
      }));

      appendAuditLog({
        category: 'Assistant Execution',
        actor: `OFinanceAssistant [${activeMode} Mode · ${result.execution_origin}]`,
        action: `Executed task ${result.task_id}: "${trimmed.slice(0, 48)}"`,
        target: '/api/v1/assistant/run',
        severity: 'Info',
        details:
          result.execution_origin === 'DEMO_ADAPTER'
            ? 'Deterministic Demo Adapter executed over in-memory dataset (0 real LLM tokens billed).'
            : 'Executed via Local FastAPI Pydantic AI runtime.',
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Assistant execution failed';
      showToast(errMsg, 'warning');
    } finally {
      setIsAssistantRunning(false);
    }
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

    if (decision === 'Approved') {
      ApprovalService.approveTask(taskId, { editedPayload }).catch(() => {});
    } else {
      ApprovalService.rejectTask(taskId, { editedPayload }).catch(() => {});
    }

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
        assistantTaskLogs,
        playgroundMessages,
        isAssistantRunning,
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
