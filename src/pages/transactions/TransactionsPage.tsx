import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOFinance } from '../../app/providers/OFinanceContext';
import { TransactionRecord, TransactionType } from '../../types';
import { calculateCashFlowTotals, formatCurrency } from '../../utils/finance';
import { Search, Link2, Eye, ArrowUpDown, X, BookOpen, RotateCcw } from 'lucide-react';
import { useI18n } from '../../i18n';

const TX_TYPES: TransactionType[] = [
  'Deposit',
  'Withdrawal',
  'Buy',
  'Sell',
  'Dividend',
  'Interest',
  'Fee',
  'Transfer',
  'FX Conversion',
  'Refund',
  'Tax',
  'Other',
];

export const TransactionsPage: React.FC = () => {
  const { t, l } = useI18n();
  const { transactions, journalEntries, baseCurrency } = useOFinance();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [accountFilter, setAccountFilter] = useState('ALL');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [directionFilter, setDirectionFilter] = useState('ALL');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState('ALL');
  const [sortField, setSortField] = useState<'date' | 'amount'>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const [selectedTx, setSelectedTx] = useState<TransactionRecord | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedTx(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const resetFilters = () => {
    setSearchQuery('');
    setAccountFilter('ALL');
    setCurrencyFilter('ALL');
    setTypeFilter('ALL');
    setDirectionFilter('ALL');
    setLedgerStatusFilter('ALL');
    setCurrentPage(1);
  };

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (accountFilter !== 'ALL' && tx.accountId !== accountFilter) return false;
        if (currencyFilter !== 'ALL' && tx.currency !== currencyFilter) return false;
        if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
        if (directionFilter !== 'ALL' && tx.direction !== directionFilter) return false;
        if (ledgerStatusFilter !== 'ALL' && tx.ledgerStatus !== ledgerStatusFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchDesc = tx.description.toLowerCase().includes(q);
          const matchPayee = tx.payee.toLowerCase().includes(q);
          const matchSym = tx.symbol?.toLowerCase().includes(q);
          const matchCat = tx.category.toLowerCase().includes(q);
          if (!matchDesc && !matchPayee && !matchSym && !matchCat) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortField === 'date') {
          return sortAsc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
        }
        return sortAsc ? a.amount - b.amount : b.amount - a.amount;
      });
  }, [
    transactions,
    accountFilter,
    currencyFilter,
    typeFilter,
    directionFilter,
    ledgerStatusFilter,
    searchQuery,
    sortField,
    sortAsc,
  ]);

  const cashFlowSummary = useMemo(
    () => calculateCashFlowTotals(filteredTransactions, baseCurrency),
    [filteredTransactions, baseCurrency]
  );

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const paginatedTx = filteredTransactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const linkedJournal = selectedTx?.journalEntryId
    ? journalEntries.find((j) => j.id === selectedTx.journalEntryId)
    : undefined;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
            {t.transactions.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.transactions.subtitle}
          </p>
        </div>

        {/* Summary Metrics Strip (Confirmed Posted vs Pending/Unconfirmed) */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
          <div className="px-2.5 py-1.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400 mr-1.5">{t.transactions.totalInflows} ({baseCurrency}):</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
              {formatCurrency(cashFlowSummary.totalInflow, baseCurrency, { showSign: true })}
            </span>
          </div>
          <div className="px-2.5 py-1.5 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400 mr-1.5">{t.transactions.totalOutflows} ({baseCurrency}):</span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold tabular-nums">
              -{formatCurrency(cashFlowSummary.totalOutflow, baseCurrency)}
            </span>
          </div>
          {(cashFlowSummary.pendingOutflow > 0 || cashFlowSummary.pendingInflow > 0) && (
            <div className="px-2.5 py-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 tabular-nums">
              <span>
                {t.common.pending}: -{formatCurrency(cashFlowSummary.pendingOutflow, baseCurrency)}
              </span>
            </div>
          )}
          <div className="px-2.5 py-1.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 tabular-nums">
            <span>
              {t.transactions.transferVolume}: {formatCurrency(cashFlowSummary.excludedTransferVolume, baseCurrency)} ({cashFlowSummary.transferPairCount} {t.transactions.transferPairsCount})
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3 rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
        <div className="relative lg:col-span-2">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            aria-label="Search transactions"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={t.transactions.searchPlaceholder}
            className="w-full pl-8 pr-3 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          aria-label="Filter by Account"
          value={accountFilter}
          onChange={(e) => {
            setAccountFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
        >
          <option value="ALL">{t.transactions.filterAccount} {t.transactions.filterAll}</option>
          <option value="acc-ibkr">{l('Interactive Brokers')}</option>
          <option value="acc-schwab">{l('Charles Schwab')}</option>
          <option value="acc-firstrade">{l('Firstrade')}</option>
          <option value="acc-us-bank">{l('US Bank Checking')}</option>
          <option value="acc-uk-bank">{l('UK Bank (Simulated)')}</option>
          <option value="acc-eu-bank">{l('European Bank Depot')}</option>
          <option value="acc-cny-bank">{l('Bank of China (Hong Kong)')}</option>
        </select>

        <select
          aria-label="Filter by Currency"
          value={currencyFilter}
          onChange={(e) => {
            setCurrencyFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-mono"
        >
          <option value="ALL">{t.transactions.filterCurrency} {t.transactions.filterAll}</option>
          <option value="USD">USD ($)</option>
          <option value="GBP">GBP (£)</option>
          <option value="EUR">EUR (€)</option>
          <option value="CNY">CNY (¥)</option>
        </select>

        <select
          aria-label="Filter by Transaction Type"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
        >
          <option value="ALL">{t.transactions.filterType} {t.transactions.filterAll}</option>
          {TX_TYPES.map((tType) => (
            <option key={tType} value={tType}>
              {l(tType)}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <select
            aria-label="Filter by Direction"
            value={directionFilter}
            onChange={(e) => {
              setDirectionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 px-2 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">{t.transactions.filterDirection} {t.transactions.filterAll}</option>
            <option value="Inflow">{t.common.inflow} (+)</option>
            <option value="Outflow">{t.common.outflow} (-)</option>
            <option value="Internal Transfer">{t.transactions.transferBadge}</option>
          </select>

          <select
            aria-label="Filter by Ledger Status"
            value={ledgerStatusFilter}
            onChange={(e) => {
              setLedgerStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 px-2 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">{t.transactions.filterLedger} {t.transactions.filterAll}</option>
            <option value="Posted">{t.common.posted}</option>
            <option value="Pending Approval">{t.common.pending}</option>
            <option value="Anomaly Flagged">Anomaly Flagged</option>
          </select>

          <button
            type="button"
            onClick={resetFilters}
            title={t.transactions.resetFilters}
            className="px-2 py-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/40">
                <th className="py-2.5 px-3 font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      if (sortField === 'date') setSortAsc(!sortAsc);
                      else {
                        setSortField('date');
                        setSortAsc(false);
                      }
                    }}
                    className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>{t.transactions.colDate}</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3 font-medium">{t.transactions.colInstitution}</th>
                <th className="py-2.5 px-3 font-medium">{t.transactions.colType}</th>
                <th className="py-2.5 px-3 font-medium">{t.transactions.colDescription}</th>
                <th className="py-2.5 px-2 font-medium">Symbol</th>
                <th className="py-2.5 px-2 font-medium text-right">Qty / Price</th>
                <th className="py-2.5 px-2 font-medium text-right">Fees</th>
                <th className="py-2.5 px-3 font-medium text-right">
                  <button
                    type="button"
                    onClick={() => {
                      if (sortField === 'amount') setSortAsc(!sortAsc);
                      else {
                        setSortField('amount');
                        setSortAsc(false);
                      }
                    }}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>{t.transactions.colAmount}</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-2.5 px-3 font-medium">{t.transactions.colCategory}</th>
                <th className="py-2.5 px-3 font-medium">{t.transactions.colLedgerStatus}</th>
                <th className="py-2.5 px-3 font-medium text-right">{t.transactions.colAction}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {paginatedTx.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    {t.transactions.noMatching}{' '}
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="text-blue-600 dark:text-blue-400 underline font-medium ml-1"
                    >
                      {t.transactions.resetFilters}
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedTx.map((tx) => (
                <tr
                  key={tx.id}
                  onClick={() => setSelectedTx(tx)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                >
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {tx.date}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{l(tx.institution)}</div>
                    <div className="text-[10px] text-slate-400">{tx.id}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {l(tx.type)}
                  </td>
                  <td className="py-2.5 px-3 max-w-sm">
                    <div className="text-slate-900 dark:text-slate-100 truncate">{tx.description}</div>
                    {tx.transferGroupId && (
                      <div className="flex items-center gap-1 text-[11px] font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                        <Link2 className="w-3 h-3 shrink-0" />
                        <span>
                          {t.transactions.transferBadge} [{tx.transferGroupId}] ↔ {l(tx.transferCounterpartyAccount)}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-2 font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    {tx.symbol || '—'}
                  </td>
                  <td className="py-2.5 px-2 font-mono text-[11px] text-right text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                    {tx.quantity ? `${tx.quantity} @ ${tx.price}` : '—'}
                  </td>
                  <td className="py-2.5 px-2 font-mono text-[11px] text-right text-slate-500 dark:text-slate-400 tabular-nums">
                    {tx.fees > 0 ? formatCurrency(tx.fees, tx.currency) : '0.00'}
                  </td>
                  <td
                    className={`py-2.5 px-3 font-mono text-right font-semibold whitespace-nowrap tabular-nums ${
                      tx.direction === 'Internal Transfer'
                        ? 'text-blue-600 dark:text-blue-400'
                        : tx.amount >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {formatCurrency(tx.amount, tx.currency, { showSign: true })} {tx.currency}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[160px]">
                    {l(tx.category)}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                    <span
                      className={
                        tx.ledgerStatus === 'Posted'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : tx.ledgerStatus === 'Anomaly Flagged'
                          ? 'text-rose-600 dark:text-rose-400 font-semibold'
                          : 'text-amber-600 dark:text-amber-400 font-semibold'
                      }
                    >
                      {l(tx.ledgerStatus)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTx(tx);
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 text-[11px]"
                    >
                      <Eye className="w-3 h-3" />
                      <span>{t.transactions.inspectBtn}</span>
                    </button>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="text-slate-500 dark:text-slate-400 font-mono">
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, filteredTransactions.length)} of{' '}
            {filteredTransactions.length} records (DEMO)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-40 text-slate-700 dark:text-slate-200 font-mono"
            >
              Prev
            </button>
            <span className="font-mono">
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-40 text-slate-700 dark:text-slate-200 font-mono"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Transaction Details Modal"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-700 rounded max-w-2xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                  {t.transactions.modalTitle} · {selectedTx.id} ({l(selectedTx.type)})
                </h3>
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  Data Source: {selectedTx.dataSource} · DEMO DATA
                </p>
              </div>
              <button
                type="button"
                aria-label={t.transactions.closeModal}
                onClick={() => setSelectedTx(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono bg-slate-50 dark:bg-slate-900/80 p-3 rounded border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 block">{t.transactions.colDate}</span>
                <span>{selectedTx.date}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">{t.accounts.accountName}</span>
                <span>{l(selectedTx.accountName)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">{t.transactions.colAmount}</span>
                <span className="font-bold">
                  {formatCurrency(selectedTx.amount, selectedTx.currency, { showSign: true })}{' '}
                  {selectedTx.currency}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">{t.transactions.colDescription}</span>
                <span>{selectedTx.payee}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">{t.accounting.colAccount}</span>
                <span>{selectedTx.category}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">{t.transactions.colLedgerStatus}</span>
                <span>{l(selectedTx.ledgerStatus)}</span>
              </div>
            </div>

            {selectedTx.transferGroupId && (
              <div className="p-3 rounded bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-mono">
                {t.transactions.transferBadge} ({selectedTx.transferGroupId}): {l(selectedTx.transferCounterpartyAccount)}.
              </div>
            )}

            <div>
              <div className="text-[11px] font-semibold text-slate-500 mb-1">
                {t.transactions.rawPayloadTitle}
              </div>
              <pre className="p-2.5 rounded bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto">
                {selectedTx.rawSourceJson}
              </pre>
            </div>

            {linkedJournal && (
              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-1">
                  Beancount Double-Entry Journal ({linkedJournal.id})
                </div>
                <pre className="p-2.5 rounded bg-slate-950 text-blue-300 font-mono text-[11px] overflow-x-auto">
                  {linkedJournal.rawBeancount}
                </pre>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedTx(null);
                  navigate('/accounting');
                }}
                className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{t.accounting.title}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium"
              >
                {t.transactions.closeModal}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
