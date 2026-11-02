# O-Finance Frontend ↔ FastAPI Backend Contract (v1 Draft)

Base URL (Local Default): `http://127.0.0.1:8000`

All frontend components communicate exclusively through the 10 modular services in `src/services/index.ts` backed by `ApiClient` (`src/services/api/client.ts`).

---

## 1. Domain Service Endpoints

| Service | Method & Endpoint | Description |
|---|---|---|
| `AccountService` | `GET /api/v1/accounts` | Returns all bank and brokerage accounts with native balances and sync freshness. |
| `AccountService` | `GET /api/v1/connectors` | Returns read-only institution connector configurations and statuses. |
| `TransactionService` | `GET /api/v1/transactions` | Returns normalized transactions including `transferGroupId` links. |
| `LedgerService` | `GET /api/v1/ledger/entries` | Returns Beancount journal entries (`Posted` `*` and `Pending Approval` `!`). |
| `LedgerService` | `GET /api/v1/ledger/fava-status` | Returns local Fava process status and `bean-check` validation result. |
| `PortfolioService` | `GET /api/v1/portfolio/holdings` | Returns aggregated positions across IBKR, Schwab, Firstrade, and EU Depot. |
| `PortfolioService` | `GET /api/v1/portfolio/history` | Returns time-series Net Worth, Cash, and Investment snapshots. |
| `PortfolioService` | `GET /api/v1/portfolio/cashflow` | Returns monthly Inflow, Outflow, and Net Savings (excluding internal transfers). |
| `MarketDataService` | `GET /api/v1/market/watchlist` | Returns watchlist quotes and valuation multiples. |
| `MarketDataService` | `GET /api/v1/market/calendar` | Returns G3 macroeconomic calendar events. |
| `ResearchService` | `GET /api/v1/research/reports` | Returns internal and external research briefings. |
| `ResearchService` | `GET /api/v1/research/connectors/daily-analysis` | Read-only status & report pull from external `daily_stock_analysis` service. |
| `ResearchService` | `POST /api/v1/quant/backtest/run` | Executes a parameterized DuckDB backtest and records an Experiment ID. |
| `AgentService` | `GET /api/v1/agents` | Returns the 7 Pydantic AI agent definitions, model assignments, and budgets. |
| `AgentService` | `POST /api/v1/agents/orchestrate` | Dispatches a user query to Orchestrator Agent and streams tool call traces. |
| `ApprovalService` | `GET /api/v1/approvals` | Returns pending and resolved human-in-the-loop approval tasks. |
| `ApprovalService` | `POST /api/v1/approvals/{id}/decide` | Records operator `Approved` or `Rejected` decision and appends audit hash. |
| `AuditService` | `GET /api/v1/audit/logs` | Returns append-only SHA-256 audit log entries. |
| `SyncService` | `POST /api/v1/sync/trigger` | Triggers read-only connector synchronization job. |
