# O-Finance REST API Contract (`/api/v1/*` · v0.3.2)

## 0. API Base URL Architecture & Normalization

All frontend modules communicate through the typed service layer (`src/services/index.ts`) backed by `src/services/api/client.ts`.

- **Server Origin**: `http://127.0.0.1:8000`
- **REST API Prefix**: `/api/v1`
- **Full Base Endpoint**: `http://127.0.0.1:8000/api/v1`
- **Environment Variable (`VITE_API_BASE_URL`)**:
  - Default: `http://127.0.0.1:8000`
  - Normalization Rule: The client's `resolveEndpointUrl()` automatically supports both `http://127.0.0.1:8000` and `http://127.0.0.1:8000/api/v1` without double-prefixing `/api/v1/api/v1`.
- **Runtime Mode Switching**:
  - `VITE_DEMO_MODE !== 'false'` (default in repo): Runs in `DEMO` mode via the deterministic in-memory Demo Adapter (`executeDeterministicDemoAssistantRun`) with 0 network calls and 0 real tokens billed.
  - `VITE_DEMO_MODE === 'false'`: Runs in `LOCAL_FASTAPI` mode, sending HTTP requests over the network to `http://127.0.0.1:8000/api/v1/*`.

---

## 1. Unified Assistant Service (`AssistantService` — `/api/v1/assistant/*`)

O-Finance consolidates all AI operations under `/api/v1/assistant/*` for the single `OFinanceAssistant` instance. All request and response payloads use strict **snake_case** for wire serialization.

### `GET /api/v1/assistant/status`
Returns the operational status of `OFinanceAssistant`, active memory index summary, and supported task modes.

### `GET /api/v1/assistant/config`
Returns the unified model and budget configuration shared across all 6 task modes.
In Demo Mode (`VITE_DEMO_MODE !== 'false'`), `api_key_configured` is strictly `false`:
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
> **Security Invariant**: The raw API key (`GEMINI_API_KEY`) is never returned in HTTP responses. In `LOCAL_FASTAPI` mode, `api_key_configured` is returned as `true` only after FastAPI verifies the key in the server's local environment.

### `POST /api/v1/assistant/run`
Executes `OFinanceAssistant` under a specified task mode profile.

**Request Payload (`AssistantRunRequestDto` — snake_case):**
```json
{
  "task_mode": "Accounting",
  "prompt": "Analyze my cash flow and verify internal transfer exclusions.",
  "user_input": "Analyze my cash flow and verify internal transfer exclusions.",
  "base_currency": "USD",
  "permitted_data_scope": "Accounts, Raw & Normalized Transactions, Beancount Ledger",
  "output_format": "AccountingDraftResult",
  "approval_policy": "Required whenever classification confidence < 0.85"
}
```

**Response Payload (`AssistantRunResponseDto` — snake_case):**
```json
{
  "task_id": "TASK-2026-032",
  "assistant_name": "OFinanceAssistant",
  "task_mode": "Accounting",
  "execution_origin": "DEMO_ADAPTER",
  "timestamp": "2026-11-02 14:30:00 UTC",
  "status": "Success (Demo Adapter)",
  "assistant_reply": "[DEMO ADAPTER · DETERMINISTIC SIMULATION] OFinanceAssistant (Accounting Mode) executed 4 deterministic functions...",
  "content": "[DEMO ADAPTER · DETERMINISTIC SIMULATION] OFinanceAssistant (Accounting Mode) executed 4 deterministic functions...",
  "duration_ms": 350,
  "tokens_used": null,
  "estimated_cost_usd": null,
  "tool_timeline": [
    {
      "step_number": 1,
      "tool_name": "Read Transactions",
      "category": "Read-Only",
      "call_signature": "read_transactions(total_records=32, base_currency=\"USD\")",
      "status": "Completed (Demo Deterministic)",
      "deterministic_finding": "Loaded 32 normalized transactions across 6 accounts; identified 2 linked internal transfer pairs.",
      "duration_ms": 95
    },
    {
      "step_number": 2,
      "tool_name": "Calculate Cash Flow",
      "category": "Deterministic Computation",
      "call_signature": "calculateCashFlowTotals(transactions, baseCurrency=\"USD\")",
      "status": "Completed (Demo Deterministic)",
      "deterministic_finding": "Confirmed Posted Inflow = $11,812.64; Confirmed Posted Outflow = -$26,742.10; Net Cash Flow = -$14,929.46. Excluded $15,000.00 internal transfers.",
      "duration_ms": 140
    }
  ],
  "structured_metrics": [
    {
      "label": "Settled Cash Inflow (USD)",
      "value": "$11,812.64",
      "delta": "Posted Only"
    },
    {
      "label": "Settled Cash Outflow (USD)",
      "value": "-$26,742.10",
      "delta": "Transfers Excluded"
    }
  ],
  "task_log": {
    "id": "TASK-2026-032",
    "timestamp": "2026-11-02 14:30:00 UTC",
    "assistant_name": "OFinanceAssistant",
    "task_mode": "Accounting",
    "execution_origin": "DEMO_ADAPTER",
    "trigger": "User Prompt",
    "task_summary": "[Demo Adapter] Accounting: \"Analyze my cash flow...\"",
    "tools_invoked": ["Read Transactions", "Calculate Cash Flow", "Verify Double-Entry Balance"],
    "duration_ms": 350,
    "tokens_used": null,
    "estimated_cost_usd": null,
    "status": "Success (Demo Adapter)",
    "output_preview": "[DEMO ADAPTER] Accounting Mode executed..."
  }
}
```

> **Telemetry Invariant**: In `DEMO_ADAPTER` mode, `tokens_used` and `estimated_cost_usd` are strictly `null` (`0 real tokens / $0.00 real spend`) so simulated runs are never misrepresented as real LLM token billing. In `LOCAL_FASTAPI_GEMINI` mode, these fields contain exact numbers verified by the Python FastAPI backend.

### `GET /api/v1/assistant/tasks`
Returns the chronological list of `OFinanceAssistant` task execution logs (`AssistantTaskLogDto[]`).

### `GET /api/v1/assistant/tasks/{task_id}`
Returns detailed step-by-step tool invocation traces and structured output for a specific task ID.

### `GET /api/v1/assistant/tools`
Returns the Unified Tool Registry grouped by capability (`Read-Only`, `Deterministic Computation`, `Drafting`, `Governance`, `Restricted (Prohibited)`).

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
