import React, { useState } from 'react';
import { useOFinance } from '../../app/providers/OFinanceContext';
import { formatCurrency } from '../../utils/finance';
import { BookOpen, CheckCircle2, XCircle, ExternalLink, ChevronDown, ChevronRight, Terminal } from 'lucide-react';

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
    journalEntries,
    wealthSummary,
    baseCurrency,
    settings,
    approveJournalDraft,
    rejectJournalDraft,
    showToast,
  } = useOFinance();

  const [expandedEntryId, setExpandedEntryId] = useState<string | null>('JE-2026-001');
  const [favaModalOpen, setFavaModalOpen] = useState(false);

  const pendingDrafts = journalEntries.filter((j) => j.status === 'Pending Approval');

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

        {/* 8.3 Fava Integration Bar */}
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

      {/* 8.1 Accounting Overview Metrics (Assets, Liabilities, Income, Expenses, Equity, Trial Balance) */}
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

      {/* 8.4 Automated Bookkeeping Workflow Pipeline */}
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

      {/* Main Split: 8.1 Beancount Account Tree (4 cols) + 8.2 Double-Entry Ledger View (8 cols) */}
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

        {/* 8.2 Double-Entry Ledger View */}
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
