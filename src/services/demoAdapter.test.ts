import test from 'node:test';
import assert from 'node:assert/strict';
import {
  executeDeterministicDemoAssistantRun,
  toAssistantTaskLogDto,
  fromAssistantTaskLogDto,
  AssistantDemoSnapshotContext,
} from './index';
import { INITIAL_ACCOUNTS } from '../mocks/accounts';
import { INITIAL_HOLDINGS } from '../mocks/portfolio';
import { INITIAL_TRANSACTIONS, INITIAL_JOURNAL_ENTRIES } from '../mocks/transactions';
import { INITIAL_APPROVAL_TASKS } from '../mocks/audit';
import { INITIAL_BACKTESTS } from '../mocks/reports';
import { calculateCashFlowTotals, calculateWealthSummary, calculateTrialBalance } from '../utils/finance';
import { AssistantTaskMode } from '../types';

const mockContext: AssistantDemoSnapshotContext = {
  baseCurrency: 'USD',
  accounts: INITIAL_ACCOUNTS,
  holdings: INITIAL_HOLDINGS,
  transactions: INITIAL_TRANSACTIONS,
  journalEntries: INITIAL_JOURNAL_ENTRIES,
  approvalTasks: INITIAL_APPROVAL_TASKS,
  backtests: INITIAL_BACKTESTS,
};

test('Demo Adapter: executes deterministically across all 6 task modes', () => {
  const modes: AssistantTaskMode[] = [
    'Accounting',
    'Portfolio Analysis',
    'Research',
    'Quantitative Research',
    'Audit',
    'Risk Analysis',
  ];

  for (const mode of modes) {
    const res = executeDeterministicDemoAssistantRun(
      {
        task_mode: mode,
        user_input: `Run automated check for ${mode}`,
        permitted_data_scope: 'Accounts, Holdings, Transactions, Ledger',
        output_format: `${mode}Result`,
        approval_policy: 'Required for high-impact mutations',
      },
      mockContext
    );

    assert.equal(res.assistant, 'OFinanceAssistant');
    assert.equal(res.assistant_name, 'OFinanceAssistant');
    assert.equal(res.task_mode, mode);
    assert.equal(res.execution_origin, 'DEMO_ADAPTER');
    assert.ok(res.content.length > 30, `Content should not be empty for ${mode}`);
    assert.ok(res.tool_timeline.length >= 2, `Tool timeline should have steps for ${mode}`);
    assert.equal(res.task_log.executionOrigin, 'DEMO_ADAPTER');

    // Strict invariant: Demo Adapter must NEVER claim real token spend or billing
    assert.equal(res.tokens_used, null, `tokens_used must be null in DEMO_ADAPTER mode`);
    assert.equal(res.estimated_cost_usd, null, `estimated_cost_usd must be null in DEMO_ADAPTER mode`);
    assert.equal(res.task_log.tokensUsed, null);
    assert.equal(res.task_log.estimatedCostUSD, null);
  }
});

test('Demo Adapter: Accounting mode dynamically computes live cash flow from transactions', () => {
  const cashFlow = calculateCashFlowTotals(mockContext.transactions, 'USD');

  const res = executeDeterministicDemoAssistantRun(
    {
      task_mode: 'Accounting',
      user_input: 'Analyze settled cash flows and verify transfer exclusions',
      permitted_data_scope: 'Transactions, Beancount Ledger',
      output_format: 'AccountingDraftResult',
      approval_policy: 'Required if confidence < 0.85',
    },
    mockContext
  );

  const calcStep = res.tool_timeline.find((s) => s.toolName === 'Calculate Cash Flow');
  assert.ok(calcStep, 'Calculate Cash Flow step must be recorded in tool timeline');
  assert.ok(
    calcStep.deterministicFinding.includes(cashFlow.totalInflow.toLocaleString('en-US', { minimumFractionDigits: 2 })),
    'Timeline must contain exact calculated cash inflow'
  );
  assert.ok(
    calcStep.deterministicFinding.includes(cashFlow.excludedTransferVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })),
    'Timeline must contain exact calculated excluded transfer volume'
  );
});

test('Demo Adapter: Risk Analysis mode dynamically computes single-stock and sector exposure', () => {
  const wealth = calculateWealthSummary(mockContext.accounts, mockContext.holdings, 'USD');

  const res = executeDeterministicDemoAssistantRun(
    {
      task_mode: 'Risk Analysis',
      user_input: 'Check portfolio concentration and liquidity',
      permitted_data_scope: 'Holdings, Cash, Risk Policy',
      output_format: 'RiskAssessmentResult',
      approval_policy: 'Automatic escalation on policy breach',
    },
    mockContext
  );

  const riskStep = res.tool_timeline.find((s) => s.toolName === 'Calculate Risk Metrics');
  assert.ok(riskStep, 'Calculate Risk Metrics step must be present');
  assert.ok(
    riskStep.deterministicFinding.includes('NVDA'),
    'Finding must identify top single holding'
  );
  assert.ok(
    res.structured_metrics.some((m) => m.label.includes('Top Position')),
    'Must include top position metric'
  );
});

test('Demo Adapter: Snake_case DTO conversion accurately round-trips task logs', () => {
  const res = executeDeterministicDemoAssistantRun(
    {
      task_mode: 'Audit',
      user_input: 'Audit transaction consistency',
      permitted_data_scope: 'Accounts, Transactions, Ledger',
      output_format: 'LedgerAuditResult',
      approval_policy: 'Required for anomalies',
    },
    mockContext
  );

  const dto = toAssistantTaskLogDto(res.task_log);
  assert.equal(dto.assistant_name, 'OFinanceAssistant');
  assert.equal(dto.task_mode, 'Audit');
  assert.equal(dto.execution_origin, 'DEMO_ADAPTER');
  assert.equal(dto.tokens_used, null);
  assert.equal(dto.estimated_cost_usd, null);

  const restored = fromAssistantTaskLogDto(dto);
  assert.equal(restored.assistantName, dto.assistant_name);
  assert.equal(restored.taskMode, dto.task_mode);
  assert.equal(restored.executionOrigin, dto.execution_origin);
  assert.equal(restored.tokensUsed, null);
  assert.equal(restored.estimatedCostUSD, null);
});

test('Double-Entry: calculateTrialBalance audits all journal entries per currency', () => {
  const tb = calculateTrialBalance(mockContext.journalEntries, {
    includePendingDrafts: true,
    baseCurrency: 'USD',
  });

  assert.equal(tb.unbalancedEntryIds.length, 0, 'No journal entries should be unbalanced');
  assert.ok(tb.isBalancedOverall, 'Overall trial balance must be balanced');
  assert.ok(tb.currencySummaries.length >= 2, 'Should summarize both USD and GBP postings');

  const usdSummary = tb.currencySummaries.find((s) => s.currency === 'USD');
  assert.ok(usdSummary, 'USD summary must be present');

  const gbpSummary = tb.currencySummaries.find((s) => s.currency === 'GBP');
  assert.ok(gbpSummary, 'GBP summary must be present');

  // Verify per-entry balance audits
  assert.equal(tb.entryAudits.length, mockContext.journalEntries.length);
  for (const ea of tb.entryAudits) {
    assert.equal(ea.isBalanced, true, `Entry ${ea.entryId} must balance`);
  }
});
