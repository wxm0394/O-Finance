import React, { useState, useEffect } from 'react';
import { useOFinance } from '../../app/providers/OFinanceContext';
import { formatCurrency } from '../../utils/finance';
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Terminal,
  Scale,
  FileSpreadsheet,
} from 'lucide-react';

const ACCOUNT_TREE = [
  {
    root: 'Assets',
    balanceUSD: '$820,832.00',
    children: [
      { name: 'Assets:Banks:Checking (US / UK)', balance: '$105,620.00 eqv' },
      { name: 'Assets:Banks:Savings (Frankfurt EUR)', balance: '€45,000.00 ($49,140.00)' },
      { name: 'Assets:Investments:InteractiveBrokers', balance: '$340,930.00' },
      { name: 'Assets:Investments:Schwab', balance: '$212,850.00' },
      { name: 'Assets:Investments:Firstrade', balance: '$81,170.00' },
      { name: 'Assets:Investments:EUBankDepot', balance: '€28,500.00 ($31,122.00)' },
    ],
  },
  {
    root: 'Liabilities',
    balanceUSD: '-$5,822.65',
    children: [
      { name: 'Liabilities:CreditCards:USBankReserve', balance: '-$3,420.00' },
      { name: 'Liabilities:CreditCards:UKSterlingCard', balance: '-£850.00 (-$1,092.25)' },
      { name: 'Liabilities:Loans:EUMarginLine', balance: '-€1,200.00 (-$1,310.40)' },
    ],
  },
  {
    root: 'Income (YTD Simulated)',
    balanceUSD: '-$294,180.00',
    children: [
      { name: 'Income:Salary (QuantCore & Advisory)', balance: '-$268,400.00' },
      { name: 'Income:Dividends (IBKR, Schwab, Firstrade)', balance: '-$12,979.00' },
      { name: 'Income:Interest (Treasury & ECB Deposit)', balance: '-$4,851.00' },
      { name: 'Income:CapitalGains (Realized YTD)', balance: '-$7,950.00' },
    ],
  },
  {
    root: 'Expenses (YTD Simulated)',
    balanceUSD: '$129,485.00',
    children: [
      { name: 'Expenses:Housing (London & US Lease)', balance: '$42,600.00' },
      { name: 'Expenses:Taxes (IRS EFTPS & Foreign Withholding)', balance: '$54,120.00' },
      { name: 'Expenses:Shopping & Cloud Infrastructure', balance: '$14,890.00' },
      { name: 'Expenses:Food & Dining', balance: '$8,940.00' },
      { name: 'Expenses:Transport (BA & Deutsche Bahn)', balance: '$4,820.00' },
      { name: 'Expenses:Healthcare (Executive Diagnostics)', balance: '$2,640.00' },
      { name: 'Expenses:Fees (Commissions, FX & Market Data)', balance: '$1,475.00' },
    ],
  },
  {
    root: 'Equity',
    balanceUSD: '-$650,314.35',
    children: [
      { name: 'Equity:OpeningBalances (2025-01-01)', balance: '-$650,314.35' },
    ],
  },
];

const TRIAL_BALANCE_ROWS = [
  { account: 'Assets:Banks:Checking:USBank', debit: 64500.0, credit: 0, currency: 'USD' },
  { account: 'Assets:Banks:Checking:UKBank (GBP 32,000)', debit: 41120.0, credit: 0, currency: 'USD eqv' },
  { account: 'Assets:Banks:Savings:EUBank (EUR 45,000)', debit: 49140.0, credit: 0, currency: 'USD eqv' },
  { account: 'Assets:Investments:InteractiveBrokers', debit: 340930.0, credit: 0, currency: 'USD' },
  { account: 'Assets:Investments:Schwab', debit: 212850.0, credit: 0, currency: 'USD' },
  { account: 'Assets:Investments:Firstrade', debit: 81170.0, credit: 0, currency: 'USD' },
  { account: 'Assets:Investments:EUBankDepot (EUR 28,500)', debit: 31122.0, credit: 0, currency: 'USD eqv' },
  { account: 'Liabilities:CreditCards:USBankReserve', debit: 0, credit: 3420.0, currency: 'USD' },
  { account: 'Liabilities:CreditCards:UKSterlingCard (GBP 850)', debit: 0, credit: 1092.25, currency: 'USD eqv' },
  { account: 'Liabilities:Loans:EUMarginLine (EUR 1,200)', debit: 0, credit: 1310.4, currency: 'USD eqv' },
  { account: 'Income:Salary:QuantCore', debit: 0, credit: 268400.0, currency: 'USD' },
  { account: 'Income:Dividends:MultiBrokerage', debit: 0, credit: 12979.0, currency: 'USD eqv' },
  { account: 'Income:Interest:YieldAndTreasury', debit: 0, credit: 4851.0, currency: 'USD eqv' },
  { account: 'Income:CapitalGains:RealizedYTD', debit: 0, credit: 7950.0, currency: 'USD' },
  { account: 'Expenses:Housing:LeaseAndUtilities', debit: 42600.0, credit: 0, currency: 'USD eqv' },
  { account: 'Expenses:Taxes:FederalAndWithholding', debit: 54120.0, credit: 0, currency: 'USD' },
  { account: 'Expenses:CloudAndInfrastructure', debit: 14890.0, credit: 0, currency: 'USD' },
  { account: 'Expenses:LivingTransportHealthcareFees', debit: 17875.0, credit: 0, currency: 'USD eqv' },
  { account: 'Equity:OpeningBalances', debit: 0, credit: 650314.35, currency: 'USD eqv' },
];

const PIPELINE_STEPS = [
  { step: '1. Raw Transaction', desc: 'Plaid / Flex XML / PSD2 JSON' },
  { step: '2. Normalization', desc: 'UTC Timestamp & ISO Currency' },
  { step: '3. Classification', desc: 'Payee & Account Mapping' },
  { step: '4. Journal Draft', desc: 'Beancount Double-Entry' },
  { step: '5. Validation', desc: 'Sum(Postings) == 0.00 Check' },
  { step: '6. Human Approval', desc: 'Confidence < 0.85 Gate' },
  { step: '7. Ledger Posting', desc: 'Append to main.beancount' },
];

export const AccountingPage: React.FC = () => {
  const {
    accounts,
    journalEntries,
    wealthSummary,
    baseCurrency,
    settings,
    approveJournalDraft,
    rejectJournalDraft,
    showToast,
  } = useOFinance();

  const [activeView, setActiveView] = useState<'ledger' | 'statements' | 'reconciliation'>('ledger');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>('JE-2026-001');
  const [favaModalOpen, setFavaModalOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFavaModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const pendingDrafts = journalEntries.filter((j) => j.status === 'Pending Approval');
  const totalDebits = TRIAL_BALANCE_ROWS.reduce((acc, r) => acc + r.debit, 0);
  const totalCredits = TRIAL_BALANCE_ROWS.reduce((acc, r) => acc + r.credit, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
            Double-Entry Accounting & Beancount Ledger (DEMO)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Plain-text double-entry accounting powered by Beancount architecture with Fava web reporting integration.
          </p>
        </div>

        {/* Fava Integration Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3 py-1.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 text-xs font-mono flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500">Ledger:</span>
            <span className="text-slate-800 dark:text-slate-200">{settings.beancountFilePath}</span>
            <span className="text-amber-600 dark:text-amber-400">(Placeholder Integration)</span>
          </div>

          <button
            type="button"
            onClick={() => setFavaModalOpen(true)}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5"
          >
            <span>Open Fava ({settings.favaUrl})</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Accounting Overview Metrics (Assets, Liabilities, Income, Expenses, Equity, Trial Balance) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 font-mono">
        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500">Total Assets ({baseCurrency})</div>
          <div className="text-base font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {formatCurrency(wealthSummary.totalCash + wealthSummary.totalInvestments, baseCurrency)}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
            Banks + Brokerages
          </div>
        </div>

        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500">Total Liabilities</div>
          <div className="text-base font-bold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
            -{formatCurrency(wealthSummary.totalLiabilities, baseCurrency)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Cards & Credit Lines</div>
        </div>

        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500">YTD Income (Sim)</div>
          <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            $294,180.00
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Salary, Div, Interest</div>
        </div>

        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500">YTD Expenses (Sim)</div>
          <div className="text-base font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            $129,485.00
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Incl. Taxes & Housing</div>
        </div>

        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500">Net Equity / Worth</div>
          <div className="text-base font-bold text-blue-600 dark:text-blue-400 mt-1 tabular-nums">
            {formatCurrency(wealthSummary.totalNetWorth, baseCurrency)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">A - L = Equity</div>
        </div>

        <div className="p-3.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500">Trial Balance Residual</div>
          <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            0.00 USD
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
            bean-check: PASSED (Sim)
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs for Accounting Views */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2 text-xs font-mono">
          {[
            { id: 'ledger', label: '1. Account Hierarchy & Journal Entries', icon: BookOpen },
            { id: 'statements', label: '2. Trial Balance, Balance Sheet & Income Statement', icon: FileSpreadsheet },
            { id: 'reconciliation', label: `3. Reconciliation Status & Drafts (${pendingDrafts.length} Pending)`, icon: Scale },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveView(tab.id as typeof activeView)}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors ${
                  activeView === tab.id
                    ? 'bg-slate-900 text-white dark:bg-blue-600'
                    : 'bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          Beancount Double-Entry Conservation: Sum(Postings) == 0.00
        </span>
      </div>

      {/* Automated Bookkeeping Workflow Pipeline & Pending Drafts (Always accessible or highlighted) */}
      <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Automated Double-Entry Bookkeeping Pipeline
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Deterministic normalization and Accounting Agent classification with human-in-the-loop approval before ledger posting
            </p>
          </div>
          <span className="text-xs font-mono text-amber-600 dark:text-amber-400">
            {pendingDrafts.length} Journal Drafts Awaiting Approval
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {PIPELINE_STEPS.map((s, idx) => (
            <div
              key={s.step}
              className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs"
            >
              <div className="font-mono font-semibold text-blue-600 dark:text-blue-400 text-[11px]">
                {s.step}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{s.desc}</div>
              {idx === 5 && pendingDrafts.length > 0 && (
                <div className="mt-1 text-[10px] font-mono text-amber-600 dark:text-amber-400 font-semibold">
                  {pendingDrafts.length} Queued
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pending Journal Drafts Review Table */}
        {pendingDrafts.length > 0 && (
          <div className="pt-2 space-y-2">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Pending Journal Drafts (Simulated In-Memory Approval — Does Not Write to Disk)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingDrafts.map((draft) => (
                <div
                  key={draft.id}
                  className="p-3 rounded bg-amber-500/5 border border-amber-500/30 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {draft.id} · {draft.date} · {draft.payee}
                    </span>
                    <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400">
                      Confidence: {((draft.confidence || 0.75) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px]">{draft.narration}</p>
                  <pre className="p-2 rounded bg-slate-950 text-emerald-400 font-mono text-[10px] overflow-x-auto">
                    {draft.rawBeancount}
                  </pre>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => approveJournalDraft(draft.id)}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve & Post (Sim)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectJournalDraft(draft.id)}
                      className="px-2.5 py-1 rounded bg-rose-600/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-medium text-[11px] flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject Draft</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* VIEW 1: Account Hierarchy Tree + Double-Entry Journal Entries */}
      {activeView === 'ledger' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Account Hierarchy Tree */}
          <div className="lg:col-span-4 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-blue-500" />
                <span>Beancount Chart of Accounts</span>
              </h2>
              <span className="text-[11px] font-mono text-slate-400">5 Root Classes</span>
            </div>

            <div className="space-y-3 text-xs font-mono">
              {ACCOUNT_TREE.map((group) => (
                <div
                  key={group.root}
                  className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white pb-1.5 border-b border-slate-200 dark:border-slate-800">
                    <span>{group.root}</span>
                    <span>{group.balanceUSD}</span>
                  </div>
                  <div className="mt-1.5 space-y-1 pl-2">
                    {group.children.map((child) => (
                      <div
                        key={child.name}
                        className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400"
                      >
                        <span className="truncate pr-2">{child.name}</span>
                        <span className="text-slate-800 dark:text-slate-200 shrink-0 tabular-nums">
                          {child.balance}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Double-Entry Ledger View */}
          <div className="lg:col-span-8 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Beancount Journal Entries (Click Row to Expand Postings)
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Every entry enforces strict double-entry conservation: Debits + Credits = 0
                </p>
              </div>
              <button
                type="button"
                onClick={() => showToast('Simulated bean-check: All 9 journal entries balance to 0.00.', 'success')}
                className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-200 hover:bg-slate-200"
              >
                Run bean-check (Sim)
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                    <th className="py-2 pr-2 font-medium">Entry ID</th>
                    <th className="py-2 px-2 font-medium">Date</th>
                    <th className="py-2 px-2 font-medium">Payee & Narration</th>
                    <th className="py-2 px-2 font-medium">Primary Account</th>
                    <th className="py-2 px-2 font-medium text-right">Debit / Credit</th>
                    <th className="py-2 pl-2 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {journalEntries.map((je) => {
                    const isExpanded = expandedEntryId === je.id;
                    const firstPosting = je.postings[0];
                    return (
                      <React.Fragment key={je.id}>
                        <tr
                          onClick={() => setExpandedEntryId(isExpanded ? null : je.id)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                        >
                          <td className="py-2.5 pr-2 font-mono text-[11px] text-blue-600 dark:text-blue-400 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                              <span>{je.id}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {je.date}
                          </td>
                          <td className="py-2.5 px-2">
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {je.flag} "{je.payee}"
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs">
                              {je.narration}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[180px]">
                            {firstPosting?.account}
                          </td>
                          <td className="py-2.5 px-2 font-mono text-right whitespace-nowrap tabular-nums">
                            {firstPosting
                              ? `${formatCurrency(firstPosting.amount, firstPosting.currency, { showSign: true })} ${firstPosting.currency}`
                              : '—'}
                          </td>
                          <td className="py-2.5 pl-2 font-mono text-[11px] text-right whitespace-nowrap">
                            <span
                              className={
                                je.status === 'Posted'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : je.status === 'Rejected'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-amber-600 dark:text-amber-400 font-semibold'
                              }
                            >
                              {je.status}
                            </span>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/70 dark:bg-slate-900/60">
                            <td colSpan={6} className="p-3 space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                                <span>Source Document: {je.sourceDocument}</span>
                                <span>Confidence: {((je.confidence || 0.99) * 100).toFixed(0)}%</span>
                              </div>
                              <pre className="p-3 rounded bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto">
                                {je.rawBeancount}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: Trial Balance, Balance Sheet & Income Statement */}
      {activeView === 'statements' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Trial Balance Table (7 cols) */}
          <div className="lg:col-span-7 p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Beancount Trial Balance (USD Base Equivalent · SIMULATED)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Verifies that total debits equal total credits across all 5 root account classes
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                Residual: {(totalDebits - totalCredits).toFixed(2)} USD
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                    <th className="py-2 pr-3 font-medium">Beancount Account</th>
                    <th className="py-2 px-3 font-medium text-right">Debit (USD)</th>
                    <th className="py-2 px-3 font-medium text-right">Credit (USD)</th>
                    <th className="py-2 pl-3 font-medium text-right">Basis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-[11px]">
                  {TRIAL_BALANCE_ROWS.map((row) => (
                    <tr key={row.account} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 pr-3 text-slate-800 dark:text-slate-200">{row.account}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-900 dark:text-white">
                        {row.debit > 0 ? formatCurrency(row.debit, 'USD') : '—'}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-blue-600 dark:text-blue-400">
                        {row.credit > 0 ? formatCurrency(row.credit, 'USD') : '—'}
                      </td>
                      <td className="py-2 pl-3 text-right text-slate-400">{row.currency}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                    <td className="py-2.5 pr-3">TOTAL TRIAL BALANCE</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(totalDebits, 'USD')}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(totalCredits, 'USD')}
                    </td>
                    <td className="py-2.5 pl-3 text-right text-emerald-600 dark:text-emerald-400">BALANCED</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Balance Sheet & Income Statement (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-2.5 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="font-sans font-semibold text-sm text-slate-900 dark:text-white">
                  Balance Sheet Snapshot (As of 2026-11-02)
                </span>
                <span className="text-[11px] text-slate-400">USD Base</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Cash & Bank Reserves</span>
                <span className="tabular-nums font-semibold">$204,260.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Investment Holdings (4 Accounts)</span>
                <span className="tabular-nums font-semibold">$616,572.00</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-1.5 font-bold">
                <span>Total Assets</span>
                <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">$820,832.00</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-500">Total Credit Cards & Margin Liabilities</span>
                <span className="text-rose-500 tabular-nums">-$5,822.65</span>
              </div>
              <div className="flex justify-between border-t-2 border-slate-200 dark:border-slate-700 pt-2 font-bold text-sm">
                <span>Net Worth (Assets - Liabilities)</span>
                <span className="text-blue-600 dark:text-blue-400 tabular-nums">$815,009.35</span>
              </div>
            </div>

            <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-2.5 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="font-sans font-semibold text-sm text-slate-900 dark:text-white">
                  Income Statement (YTD Simulated)
                </span>
                <span className="text-[11px] text-emerald-500">56.0% Net Margin</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Salary & Advisory Compensation</span>
                <span className="tabular-nums text-emerald-500">+$268,400.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Portfolio Dividends & Interest</span>
                <span className="tabular-nums text-emerald-500">+$17,830.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Realized Capital Gains (YTD)</span>
                <span className="tabular-nums text-emerald-500">+$7,950.00</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-1.5 font-bold">
                <span>Total Gross Income</span>
                <span className="tabular-nums">$294,180.00</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-500">Taxes, Housing, Cloud & Operating Expenses</span>
                <span className="tabular-nums text-rose-500">-$129,485.00</span>
              </div>
              <div className="flex justify-between border-t-2 border-slate-200 dark:border-slate-700 pt-2 font-bold text-sm">
                <span>Net Retained Savings (YTD)</span>
                <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">+$164,695.00</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: Institution Statement vs Beancount Ledger Reconciliation */}
      {activeView === 'reconciliation' && (
        <div className="p-4 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Multi-Institution Statement vs. Beancount Ledger Reconciliation (DEMO)
              </h2>
              <p className="text-[11px] text-slate-500">
                Compares external simulated bank/brokerage statement balances against posted Beancount assertions (`balance` directives).
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
              Posted Ledger Discrepancy: 0.00
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                  <th className="py-2 pr-3 font-medium">Account</th>
                  <th className="py-2 px-3 font-medium">Beancount Directive Account</th>
                  <th className="py-2 px-3 font-medium text-right">Statement Balance</th>
                  <th className="py-2 px-3 font-medium text-right">Beancount Posted</th>
                  <th className="py-2 px-3 font-medium text-right">Unposted Drafts</th>
                  <th className="py-2 pl-3 font-medium text-right">Reconciliation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-[11px]">
                {accounts.map((acc) => {
                  const hasUnposted = acc.id === 'acc-us-bank';
                  const hasAnomaly = acc.id === 'acc-eu-bank';
                  return (
                    <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 pr-3 font-sans font-medium text-slate-900 dark:text-white">
                        {acc.institution.replace(' (Simulated)', '')} ({acc.currency})
                      </td>
                      <td className="py-2.5 px-3 text-blue-600 dark:text-blue-400">
                        Assets:{acc.accountType}:{acc.institution.replace(/[^a-zA-Z]/g, '')}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {formatCurrency(acc.currentBalance, acc.currency)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {formatCurrency(acc.currentBalance, acc.currency)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {hasUnposted ? '2 Drafts ($2,120.00)' : hasAnomaly ? '1 Fee Flag (€45.00)' : '0 Drafts'}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <span
                          className={
                            hasUnposted || hasAnomaly
                              ? 'text-amber-600 dark:text-amber-400 font-semibold'
                              : 'text-emerald-600 dark:text-emerald-400 font-semibold'
                          }
                        >
                          {hasUnposted
                            ? 'Pending Draft Approval'
                            : hasAnomaly
                            ? 'Fee Anomaly Flagged'
                            : 'Reconciled (0.00 Diff)'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fava Placeholder Integration Modal */}
      {favaModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fava Integration Status"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-700 rounded max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
              Fava Local Web UI Integration (Placeholder Mode)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              In O-Finance’s architecture, <strong>Beancount</strong> is the authoritative plain-text double-entry ledger and <strong>Fava</strong> serves as the dedicated accounting report interface running locally at <code className="font-mono text-blue-400">{settings.favaUrl}</code>.
            </p>
            <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-mono space-y-1">
              <div>Fava Service Status: Offline (Cloud Demo Environment)</div>
              <div>Ledger File Path: {settings.beancountFilePath}</div>
              <div>Local Command: fava ~/o-finance/ledger/main.beancount --port 5000</div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setFavaModalOpen(false)}
                className="px-4 py-1.5 rounded bg-blue-600 text-white text-xs font-medium"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
