# O-Finance REST API Contract (`/api/v1/*` · v0.3)

All frontend modules communicate through the typed service layer (`src/services/index.ts`) backed by `src/services/api/client.ts`. When `VITE_DEMO_MODE=true` (default in the cloud preview), requests resolve deterministically against local mock datasets. When connected to the local Python FastAPI backend on Kali Linux, the same interface targets `http://127.0.0.1:8000/api/v1/*`.

---

## 1. Unified Assistant Service (`AssistantService` — `/api/v1/assistant/*`)

O-Finance v0.3 consolidates all AI operations under `/api/v1/assistant/*` for the single `OFinanceAssistant` instance.

### `GET /api/v1/assistant/status`
Returns the operational status of `OFinanceAssistant`, active memory index summary, and supported task modes.

### `GET /api/v1/assistant/config`
Returns the unified model and budget configuration shared across all 6 task modes:
```json
{
  "provider": "Gemini",
  "model": "gemini-2.5-pro",
  "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
  "api_key_configured": true,
  "model_status": "Simulated Configured",
  "request_timeout": 45,
  "max_output_tokens": 4096,
  "daily_budget_usd": 25.0,
  "per_task_budget_usd": 0.75
}
```
> **Security Note**: The raw API key is never returned by `/api/v1/assistant/config`; only the boolean `api_key_configured` flag is exposed to the UI.

### `POST /api/v1/assistant/run`
Executes `OFinanceAssistant` under a specified task mode profile.

**Request Payload:**
```json
{
  "task_mode": "Accounting",
  "user_input": "Analyze my October cash flow and verify internal transfer exclusions.",
  "permitted_data_scope": "Accounts, Raw & Normalized Transactions, Beancount Ledger",
  "output_format": "AccountingDraftResult",
  "approval_policy": "Required whenever classification confidence < 0.85"
}
```

**Response Payload:**
```json
{
  "task_id": "ALOG-031",
  "assistant": "OFinanceAssistant",
  "task_mode": "Accounting",
  "status": "Success (Simulated)",
  "tool_timeline": [
    {
      "step_number": 1,
      "tool_name": "Read Transactions",
      "status": "Completed (Simulated)",
      "duration_ms": 110
    },
    {
      "step_number": 2,
      "tool_name": "Calculate Cash Flow",
      "status": "Completed (Simulated)",
      "duration_ms": 165
    }
  ]
}
```

### `GET /api/v1/assistant/tasks`
Returns the chronological list of `OFinanceAssistant` task execution logs across all 6 task modes.

### `GET /api/v1/assistant/tasks/{task_id}`
Returns detailed step-by-step tool invocation traces and structured output for a specific task ID.

### `GET /api/v1/assistant/tools`
Returns the Unified Tool Registry grouped by capability (`Read-Only`, `Deterministic Computation`, `Drafting`, `Governance`, and `Restricted (Prohibited)`).

### `GET /api/v1/assistant/usage`
Returns daily token consumption, cumulative daily USD spend, `daily_budget_usd`, and `per_task_budget_usd`.

---

## 2. Core Financial, Ledger, Quant & Governance Endpoints

| Domain Service | Endpoint | Method | Description |
| :--- | :--- | :--- | :--- |
| `AccountService` | `/api/v1/accounts` | `GET` | Multi-institution accounts and native/base balances. |
| `AccountService` | `/api/v1/connectors` | `GET` | Read-only institution connector status and sync metadata. |
| `TransactionService` | `/api/v1/transactions` | `GET` | Normalized transaction feed with internal transfer links. |
| `LedgerService` | `/api/v1/ledger/entries` | `GET` | Beancount double-entry journal postings and drafts. |
| `LedgerService` | `/api/v1/ledger/fava-status` | `GET` | Local Fava web reporting daemon health and ledger path. |
| `PortfolioService` | `/api/v1/portfolio/holdings` | `GET` | Cross-brokerage holdings, cost basis, and P&L. |
| `MarketDataService` | `/api/v1/market/watchlist` | `GET` | Global watchlist quotes and economic calendar. |
| `ResearchService` | `/api/v1/quant/backtest/run` | `POST` | Parameterized deterministic DuckDB backtest execution. |
| `ResearchService` | `/api/v1/research/connectors/daily-analysis` | `GET` | Read-only status for external `daily_stock_analysis` service. |
| `ApprovalService` | `/api/v1/approvals` | `GET` | Human-in-the-loop approval tasks and draft payloads. |
| `AuditService` | `/api/v1/audit/logs` | `GET` | Append-only SHA-256 cryptographic audit trail. |
| `SyncService` | `/api/v1/sync/trigger` | `POST` | Trigger simulated read-only connector sync. |
