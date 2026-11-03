/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { I18nProvider } from './i18n';
import { OFinanceProvider } from './app/providers/OFinanceContext';
import { WorkstationShell } from './app/layout/WorkstationShell';
import { OverviewPage } from './pages/overview/OverviewPage';
import { AccountsPage } from './pages/accounts/AccountsPage';
import { TransactionsPage } from './pages/transactions/TransactionsPage';
import { AccountingPage } from './pages/accounting/AccountingPage';
import { PortfolioPage } from './pages/portfolio/PortfolioPage';
import { MarketIntelligencePage } from './pages/market-intelligence/MarketIntelligencePage';
import { QuantLabPage } from './pages/quant-lab/QuantLabPage';
import { AgentCenterPage } from './pages/agent-center/AgentCenterPage';
import { ApprovalInboxPage } from './pages/approvals/ApprovalInboxPage';
import { AuditSecurityPage } from './pages/audit/AuditSecurityPage';
import { SettingsPage } from './pages/settings/SettingsPage';

export default function App() {
  return (
    <I18nProvider>
      <OFinanceProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<WorkstationShell />}>
              <Route index element={<OverviewPage />} />
              <Route path="accounts" element={<AccountsPage />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="accounting" element={<AccountingPage />} />
              <Route path="portfolio" element={<PortfolioPage />} />
              <Route path="market-intelligence" element={<MarketIntelligencePage />} />
              <Route path="quant-lab" element={<QuantLabPage />} />
              <Route path="agent-center" element={<AgentCenterPage />} />
              <Route path="approvals" element={<ApprovalInboxPage />} />
              <Route path="audit" element={<AuditSecurityPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </OFinanceProvider>
    </I18nProvider>
  );
}
