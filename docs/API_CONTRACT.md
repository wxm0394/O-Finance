# O-Finance REST API Contract (`/api/v1/*` · v0.3.1)

All frontend modules communicate through the typed service layer (`src/services/index.ts`) backed by `src/services/api/client.ts`.
- **Demo Adapter Mode (`VITE_DEMO_MODE !== 'false'`, default in repository)**: Requests resolve against local mock datasets and the deterministic Demo Adapter (`executeDeterministicDemoAssistantRun`), which computes financial figures dynamically via `src/utils/finance.ts`.
- **Local FastAPI Mode (`VITE_DEMO_MODE === 'false'`, Phase 2 on Kali Linux)**: The same service layer dispatches HTTP requests to `http://127.0.0.1:8000/api/v1/*` served by the local Python FastAPI + Pydantic AI + Gemini backend.

---

## 1. Unified Assistant Service (`AssistantService` — `/api/v1/assistant/*`)

O-Finance v0.3.1 consolidates all AI operations under `/api/v1/assistant/*` for the single `OFinanceAssistant` instance.

### `GET /api/v1/assistant/status`
Returns the operational status of `OFinanceAssistant`, active memory index summary, and supported task modes.

### `GET /api/v1/assistant/config`
Returns the unified model and budget configuration shared across all 6 task modes.
In Demo Mode (`VITE_DEMO_MODE !== 'false'`), `api_key_configured` is `false` because no backend key verification has occurred:
```json
{
  "provider": "Gemini",
  "model": "gemini-2.5-pro",
  "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
  "api_key_configured": false,
  "api_key_status": "Simulated / Unknown (Unverified in Demo Mode)",
  "model_status": "Simulated / Unknown (Demo Mode)",
  "request_timeout": 45,
  "max_output_tokens": 4096,
  "daily_budget_usd": 25.0,
  "per_task_budget_usd": 0.75
}
```
> **Security Note**: The raw `GEMINI_API_KEY` is never returned by `/api/v1/assistant/config` or stored in the frontend; only the backend-verified `api_key_configured` boolean and `api_key_status` string are exposed to the UI. Switching model presets (`PATCH /api/v1/assistant/config`) only updates `provider`, `model`, and `base_url`.

### `POST /api/v1/assistant/run`
Executes `OFinanceAssistant` under a specified task mode profile (`AssistantRunRequestPayload` → `AssistantRunResponsePayload`).

**Request Payload:**
```json
{
  "prompt": "Analyze my cash flow and verify internal transfer exclusions.",
  "preferredTaskMode": "Auto",
  "baseCurrency": "USD"
}
```

**Response Payload (Demo Adapter vs. Local FastAPI Backend):**
```json
{
  "executionOrigin": "DEMO_ADAPTER",
  "resolvedMode": "Accounting",
  "assistantReply": "[OFinanceAssistant · Accounting Mode · DEMO ADAPTER]\nExecuted deterministic tool chain...",
  "taskLog": {
    "id": "ALOG-031",
    "timestamp": "2026-11-02 14:25:00",
    "assistantName": "OFinanceAssistant",
    "taskMode": "Accounting",
    "executionOrigin": "DEMO_ADAPTER",
    "taskSummary": "Prompt execution [Accounting]: Analyze my cash flow...",
    "toolsInvoked": [
      "Read Accounts",
      "Read Transactions",
      "Calculate Cash Flow",
      "Verify Double-Entry Balance"
    ],
    "deterministicBoundary": "All financial calculations executed via deterministic TypeScript/Python functions; LLM used only for classification and narrative synthesis.",
    "durationMs": 420,
    "tokensUsed": null,
    "estimatedCostUSD": null,
    "status": "Success (Simulated)"
  }
}
```
> In `DEMO_ADAPTER` mode, `tokensUsed` and `estimatedCostUSD` are `null` (`0 real tokens / $0.00 real spend`) so simulated runs are never confused with real Gemini API billing. In `LOCAL_FASTAPI_GEMINI` mode, the FastAPI backend populates real token counts and USD cost from the Pydantic AI `RunResult.usage()` object.

### `GET /api/v1/assistant/tasks`
Returns the chronological list of `OFinanceAssistant` task execution logs (`AssistantTaskLog[]`) across all 6 task modes.

### `GET /api/v1/assistant/tasks/{task_id}`
Returns detailed step-by-step tool invocation traces and structured output for a specific task ID.

### `GET /api/v1/assistant/tools`
Returns the Unified Tool Registry (`AssistantToolPermission[]`) grouped by capability (`Read-Only`, `Deterministic Computation`, `Drafting`, `Governance`, and `Restricted (Prohibited)`).

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
