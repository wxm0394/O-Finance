import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  BookOpen,
  PieChart,
  Globe,
  FlaskConical,
  Cpu,
  CheckSquare,
  ShieldCheck,
  Settings,
  Search,
  RefreshCw,
  Bell,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useOFinance } from '../providers/OFinanceContext';
import { CurrencyCode } from '../../types';
import { FX_LAST_UPDATED, SIMULATED_FX_RATES_TO_USD } from '../../utils/finance';
import { ApiClient } from '../../services/api/client';
import { useI18n, LocaleSwitcher } from '../../i18n';

export const WorkstationShell: React.FC = () => {
  const { t, locale } = useI18n();
  const {
    baseCurrency,
    setBaseCurrency,
    settings,
    updateSettings,
    globalSearchQuery,
    setGlobalSearchQuery,
    toastMessage,
    approvalTasks,
    accounts,
    holdings,
    transactions,
    isSyncing,
    lastGlobalSync,
    triggerSimulatedSync,
  } = useOFinance();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', label: t.nav.overview.main, sub: t.nav.overview.sub, icon: LayoutDashboard },
    { path: '/accounts', label: t.nav.accounts.main, sub: t.nav.accounts.sub, icon: Landmark },
    { path: '/transactions', label: t.nav.transactions.main, sub: t.nav.transactions.sub, icon: ArrowLeftRight },
    { path: '/accounting', label: t.nav.accounting.main, sub: t.nav.accounting.sub, icon: BookOpen },
    { path: '/portfolio', label: t.nav.portfolio.main, sub: t.nav.portfolio.sub, icon: PieChart },
    { path: '/market-intelligence', label: t.nav.market.main, sub: t.nav.market.sub, icon: Globe },
    { path: '/quant-lab', label: t.nav.quant.main, sub: t.nav.quant.sub, icon: FlaskConical },
    { path: '/agent-center', label: t.nav.assistant.main, sub: t.nav.assistant.sub, icon: Cpu },
    { path: '/approvals', label: t.nav.approvals.main, sub: t.nav.approvals.sub, icon: CheckSquare },
    { path: '/audit', label: t.nav.audit.main, sub: t.nav.audit.sub, icon: ShieldCheck },
    { path: '/settings', label: t.nav.settings.main, sub: t.nav.settings.sub, icon: Settings },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const pendingApprovalsCount = approvalTasks.filter((t) => t.status === 'Pending').length;

  const currentNav =
    navItems.find((item) =>
      item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
    ) || navItems[0];

  // Global search filter across accounts, holdings, and transactions
  const q = globalSearchQuery.trim().toLowerCase();
  const matchedAccounts = q
    ? accounts.filter(
        (a) =>
          a.accountName.toLowerCase().includes(q) ||
          a.institution.toLowerCase().includes(q) ||
          a.currency.toLowerCase().includes(q)
      )
    : [];
  const matchedHoldings = q
    ? holdings.filter(
        (h) =>
          h.symbol.toLowerCase().includes(q) ||
          h.securityName.toLowerCase().includes(q) ||
          h.sector.toLowerCase().includes(q)
      )
    : [];
  const matchedTransactions = q
    ? transactions
        .filter(
          (t) =>
            t.description.toLowerCase().includes(q) ||
            t.payee.toLowerCase().includes(q) ||
            (t.symbol && t.symbol.toLowerCase().includes(q))
        )
        .slice(0, 5)
    : [];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100">
      {/* Top Status Bar (Min 60px height, responsive flex alignment) */}
      <header className="min-h-[60px] py-2 shrink-0 border-b border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0F1420] px-4 flex items-center justify-between gap-3 z-30">
        {/* Left: Brand + Workspace + Demo Banner */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-left focus:outline-none py-1"
          >
            <div className="w-8 h-8 rounded bg-slate-900 dark:bg-blue-600 text-white font-mono font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
              O
            </div>
            <div className="leading-tight">
              <span className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-white whitespace-nowrap block">
                {t.nav.brandTitle}
              </span>
              <span className="hidden 2xl:inline-block text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {t.nav.brandSubtitle}
              </span>
            </div>
          </button>

          <span className="text-slate-300 dark:text-slate-700 hidden md:inline" aria-hidden="true">
            /
          </span>

          <div className="hidden 2xl:flex items-center gap-1.5 text-[11px] font-mono text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded whitespace-nowrap shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{t.nav.demoBadge}</span>
          </div>
        </div>

        {/* Center: Global Search (compact flexible width) */}
        <div className="relative w-28 sm:w-40 md:w-48 lg:w-56 shrink min-w-[90px] mx-1">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              aria-label="Global Workstation Search"
              value={globalSearchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setGlobalSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder={t.nav.searchPlaceholder}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-sans"
            />
            {globalSearchQuery && (
              <button
                type="button"
                aria-label="Clear global search"
                onClick={() => {
                  setGlobalSearchQuery('');
                  setSearchOpen(false);
                }}
                className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {searchOpen && q.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-[#131A29] border border-slate-200 dark:border-slate-700 rounded shadow-xl p-3 z-50 max-h-96 overflow-y-auto text-xs">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <span>Search Results for "{globalSearchQuery}" (DEMO)</span>
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  Close
                </button>
              </div>

              {matchedAccounts.length === 0 &&
                matchedHoldings.length === 0 &&
                matchedTransactions.length === 0 && (
                  <p className="py-4 text-center text-slate-500">
                    No matching accounts, holdings, or transactions found.
                  </p>
                )}

              {matchedAccounts.length > 0 && (
                <div className="mb-3">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1">Accounts</div>
                  {matchedAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        navigate('/accounts');
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800/70 flex items-center justify-between"
                    >
                      <span>{acc.accountName}</span>
                      <span className="font-mono text-slate-400">{acc.currency}</span>
                    </button>
                  ))}
                </div>
              )}

              {matchedHoldings.length > 0 && (
                <div className="mb-3">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1">Portfolio Holdings</div>
                  {matchedHoldings.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        navigate('/portfolio');
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800/70 flex items-center justify-between"
                    >
                      <span>
                        <strong className="font-mono">{h.symbol}</strong> · {h.securityName}
                      </span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        {h.quantity} sh @ {h.currentPrice} {h.currency}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {matchedTransactions.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 mb-1">Transactions</div>
                  {matchedTransactions.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        navigate('/transactions');
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800/70 flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{t.description}</span>
                      <span className="font-mono shrink-0">
                        {t.amount} {t.currency}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Base Currency Switcher, Sync, Locale Switcher, Notifications, Theme, Operator */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 text-xs">
          {/* Base Currency Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-0.5 shrink-0">
            {(['USD', 'GBP', 'EUR', 'CNY'] as CurrencyCode[]).map((curr) => (
              <button
                key={curr}
                type="button"
                aria-label={`Set Base Currency ${curr}`}
                onClick={() => setBaseCurrency(curr)}
                className={`px-1.5 sm:px-2 py-1 text-[11px] font-mono font-medium rounded transition-colors ${
                  baseCurrency === curr
                    ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {curr}
              </button>
            ))}
          </div>

          {/* Simulated Sync Button */}
          <button
            type="button"
            title={isSyncing ? t.nav.syncing : t.nav.syncNow}
            onClick={() => triggerSimulatedSync()}
            disabled={isSyncing}
            className="flex items-center gap-1 px-2 py-1.5 rounded bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-500' : ''}`} />
            <span className="hidden xl:inline">
              {isSyncing ? (locale === 'zh' ? '同步中' : 'Syncing') : (locale === 'zh' ? '同步' : 'Sync')}
            </span>
          </button>

          {/* Bilingual Locale Switcher [ EN | 中文 ] */}
          <LocaleSwitcher />

          {/* Notifications / Approval Quick Drawer */}
          <div className="relative shrink-0">
            <button
              type="button"
              aria-label={t.nav.notifications}
              onClick={() => setNotificationsOpen((prev) => !prev)}
              className="relative p-1.5 rounded bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
            >
              <Bell className="w-4 h-4" />
              {pendingApprovalsCount > 0 && (
                <span className="ml-1 font-mono text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-80 bg-white dark:bg-[#131A29] border border-slate-200 dark:border-slate-700 rounded shadow-xl p-3 z-50 text-xs">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-semibold">System Alerts & Approvals (DEMO)</span>
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(false)}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {approvalTasks
                    .filter((t) => t.status === 'Pending')
                    .slice(0, 4)
                    .map((task) => (
                      <div
                        key={task.id}
                        className="p-2 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800"
                      >
                        <div className="font-medium text-slate-900 dark:text-slate-100">{task.title}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {task.assistantName} ({task.taskMode}) · Risk: {task.riskLevel}
                        </div>
                      </div>
                    ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(false);
                    navigate('/approvals');
                  }}
                  className="mt-2.5 w-full py-1.5 text-center rounded bg-blue-600 text-white font-medium hover:bg-blue-500"
                >
                  Open Approval Inbox ({pendingApprovalsCount} Pending)
                </button>
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            aria-label="Toggle Dark or Light Theme"
            onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
            className="p-1.5 rounded bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shrink-0"
          >
            {settings.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Operator Profile */}
          <button
            type="button"
            onClick={() => navigate('/settings')}
            title={`${t.nav.operator} (${t.nav.operatorRole})`}
            className="flex items-center gap-1.5 pl-1.5 border-l border-slate-200 dark:border-slate-800 text-left shrink-0"
          >
            <div className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-semibold flex items-center justify-center shrink-0">
              OP
            </div>
            <div className="hidden xl:block leading-tight">
              <div className="text-[11px] font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                {t.nav.operator}
              </div>
              <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {t.nav.operatorRole}
              </div>
            </div>
          </button>
        </div>
      </header>

      {/* Main Workspace Container */}
      <div className="flex-1 flex min-h-0">
        {/* Left Navigation Sidebar (~240px or collapsed 64px) */}
        <aside
          aria-label="Primary Workstation Navigation"
          className={`${
            sidebarCollapsed ? 'w-16' : 'w-60'
          } shrink-0 border-r border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0F1420] flex flex-col justify-between transition-all duration-150`}
        >
          <nav className="p-2 space-y-0.5 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isApprovals = item.path === '/approvals';
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  title={sidebarCollapsed ? `${item.label} — ${item.sub}` : undefined}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-2.5 py-2 rounded text-xs transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-white dark:bg-blue-600/20 dark:text-blue-300 dark:border dark:border-blue-500/30 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                    }`
                  }
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    {!sidebarCollapsed && (
                      <div className="truncate">
                        <div className="leading-tight truncate">{item.label}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                          {item.sub}
                        </div>
                      </div>
                    )}
                  </div>
                  {!sidebarCollapsed && isApprovals && pendingApprovalsCount > 0 && (
                    <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                      {pendingApprovalsCount}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Bottom Sidebar System Status & Collapse Toggle */}
          <div className="p-2.5 border-t border-slate-200 dark:border-slate-800/90 space-y-2 text-[11px]">
            {!sidebarCollapsed && (
              <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 space-y-1 font-mono">
                <div className="flex items-center justify-between">
                  <span>{t.nav.modeLabel}</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">SIMULATED</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t.nav.fxLabel}</span>
                  <span className="truncate" title={`GBP: ${SIMULATED_FX_RATES_TO_USD.GBP} | EUR: ${SIMULATED_FX_RATES_TO_USD.EUR} | CNY: ${SIMULATED_FX_RATES_TO_USD.CNY}`}>
                    {SIMULATED_FX_RATES_TO_USD.GBP} / {SIMULATED_FX_RATES_TO_USD.EUR} / {SIMULATED_FX_RATES_TO_USD.CNY}
                  </span>
                </div>
                <div className="truncate text-[10px]" title={lastGlobalSync}>
                  {t.nav.syncLabel} {lastGlobalSync.slice(5, 16)}
                </div>
              </div>
            )}

            <button
              type="button"
              aria-label={sidebarCollapsed ? t.nav.expandNav : t.nav.collapseNav}
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <>
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{t.nav.collapseNav}</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
          {/* Sub-Header Context Strip */}
          <div className="px-6 py-2.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/60 dark:bg-[#0D121C] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-slate-100">{currentNav.label}</span>
              <span aria-hidden="true">·</span>
              <span>{currentNav.sub}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-amber-600 dark:text-amber-400">
                {t.nav.demoBadge}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span>{t.nav.baseCurrencyLabel} {baseCurrency}</span>
              <span aria-hidden="true">·</span>
              <span>{t.nav.fxUpdatedLabel} {FX_LAST_UPDATED}</span>
            </div>
          </div>

          {/* Toast Feedback Banner if active */}
          {toastMessage && (
            <div className="mx-6 mt-3 px-4 py-2 rounded border border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-200 text-xs flex items-center justify-between">
              <span className="font-mono">{toastMessage.text}</span>
              <span className="text-[11px] opacity-75">DEMO STATE UPDATED</span>
            </div>
          )}

          {/* Routed Page Outlet */}
          <div className="p-6 flex-1">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
