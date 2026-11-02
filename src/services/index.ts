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
  INITIAL_AGENT_LOGS,
} from '../mocks/agents';
import { INITIAL_APPROVAL_TASKS, INITIAL_AUDIT_LOGS } from '../mocks/audit';
import { runDeterministicBacktest } from '../utils/finance';
import { AssistantTaskMode } from '../types';

/**
 * 10 Modular Domain Services (O-Finance v0.3 Architecture):
 * 1. AccountService
 * 2. TransactionService
 * 3. LedgerService
 * 4. PortfolioService
 * 5. MarketDataService
 * 6. ResearchService
 * 7. AssistantService (Single Assistant `/api/v1/assistant/*` contract)
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
    ApiClient.request('/api/v1/ledger/fava-status', () => ({
      serviceStatus: 'Placeholder Integration (Local Fava Not Running)',
      favaUrl: 'http://127.0.0.1:5000',
      ledgerFilePath: '~/o-finance/ledger/main.beancount (Simulated Path)',
      lastValidated: '2026-11-02 14:16:05 UTC',
      isBalanced: true,
    })),
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
  getReports: () => ApiClient.request('/api/v1/research/reports', () => INITIAL_RESEARCH_REPORTS),
  getStrategies: () => ApiClient.request('/api/v1/quant/strategies', () => INITIAL_STRATEGIES),
  getBacktests: () => ApiClient.request('/api/v1/quant/backtests', () => INITIAL_BACKTESTS),
  executeBacktest: (params: Parameters<typeof runDeterministicBacktest>[0]) =>
    ApiClient.request('/api/v1/quant/backtest/run', () => runDeterministicBacktest(params)),
  getDailyAnalysisConnectorStatus: () =>
    ApiClient.request('/api/v1/research/connectors/daily-analysis', () => ({
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
  runTask: (payload: {
    task_mode: AssistantTaskMode;
    user_input: string;
    permitted_data_scope: string;
    output_format: string;
    approval_policy: string;
  }) =>
    ApiClient.request('/api/v1/assistant/run', () => ({
      task_id: `TASK-${Date.now()}`,
      assistant: 'OFinanceAssistant' as const,
      task_mode: payload.task_mode,
      status: 'Success (Simulated)',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    })),
  getTasks: () => ApiClient.request('/api/v1/assistant/tasks', () => INITIAL_AGENT_LOGS),
  getTaskById: (taskId: string) =>
    ApiClient.request(`/api/v1/assistant/tasks/${taskId}`, () =>
      INITIAL_AGENT_LOGS.find((t) => t.id === taskId) || INITIAL_AGENT_LOGS[0]
    ),
  getTools: () => ApiClient.request('/api/v1/assistant/tools', () => INITIAL_TOOL_PERMISSIONS),
  getUsage: () =>
    ApiClient.request('/api/v1/assistant/usage', () => ({
      assistant: 'OFinanceAssistant' as const,
      tokensUsedToday: OFINANCE_ASSISTANT_STATUS.tokensUsedToday,
      budgetUsedTodayUSD: OFINANCE_ASSISTANT_STATUS.budgetUsedTodayUSD,
      dailyBudgetUSD: INITIAL_UNIFIED_MODEL_CONFIG.daily_budget_usd,
      perTaskBudgetUSD: INITIAL_UNIFIED_MODEL_CONFIG.per_task_budget_usd,
    })),
};

export const ApprovalService = {
  getTasks: () => ApiClient.request('/api/v1/approvals', () => INITIAL_APPROVAL_TASKS),
};

export const AuditService = {
  getLogs: () => ApiClient.request('/api/v1/audit/logs', () => INITIAL_AUDIT_LOGS),
};

export const SyncService = {
  triggerSimulatedSync: (targetInstitution?: string) =>
    ApiClient.request('/api/v1/sync/trigger', () => ({
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      status: 'Simulated Sync Completed — No Real Financial Institution Connected',
      target: targetInstitution || 'All Demo Accounts',
    })),
};
