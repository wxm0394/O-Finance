# O-Finance AI Assistant Runtime Specification (`OFinanceAssistant` · v0.3.1)

## 1. Core Architectural Decision: Single Assistant Only

O-Finance v0.3.1 uses a **Single Assistant Architecture** built around one reusable **Pydantic AI** agent specification:

- **Assistant Identifier**: `OFinanceAssistant`
- **One Shared Runtime**: No multi-agent swarm, no LangGraph state-machine complexity, and no specialist sub-agent instances.
- **Phase 1 Single Cloud LLM Provider (`Gemini`)**: Phase 1 fixes **Google Gemini** (`gemini-2.5-pro` and `gemini-2.5-flash`) as the sole cloud LLM provider so all 6 task modes share a single backend `GEMINI_API_KEY`. `Local Ollama` (`qwen2.5-coder:32b-instruct-q4_K_M`) is retained as an optional global offline mode. Multi-key provider rosters (`Claude`, `OpenAI-Compatible`) are excluded from Phase 1 to prevent multi-key management ambiguity.
- **Honest API Key State (`api_key_configured`)**:
  - The API key is stored exclusively in the Python FastAPI backend environment (`GEMINI_API_KEY` / `OFINANCE_AI_API_KEY`).
  - Model preset switching (`applyModelPreset`) only updates `provider`, `model`, and `base_url`—it never sets `api_key_configured: true`.
  - In Demo Mode (`VITE_DEMO_MODE !== 'false'`), `api_key_configured` is `false` and `api_key_status` is `Simulated / Unknown (Unverified in Demo Mode)`. Only the real FastAPI backend may return `api_key_configured: true` after verifying the backend environment key.

---

## 2. Dual-Mode Execution Architecture (`AssistantService.runTask`)

When the operator submits a prompt in the **AI Assistant Center**, `OFinanceContext.sendPlaygroundPrompt()` always invokes `AssistantService.runTask(payload)`:

1. **Mode A — Deterministic Demo Adapter (`VITE_DEMO_MODE !== 'false'`)**:
   - Executes `executeDeterministicDemoAssistantRun()` in `src/services/index.ts`.
   - Reads the live in-memory `accounts`, `holdings`, `transactions`, and `journalEntries` state and invokes deterministic calculations from `src/utils/finance.ts` (`calculateWealthSummary`, `calculateCashFlowTotals`, concentration weights, and trial balance checks).
   - Never uses hardcoded cash-flow or net-worth strings.
   - Records `executionOrigin: 'DEMO_ADAPTER'`, `tokensUsed: null`, and `estimatedCostUSD: null` (`0 real tokens / $0.00 real spend`) so simulated runs are never disguised as live Gemini token billing.
2. **Mode B — Local FastAPI + Pydantic AI Adapter (`VITE_DEMO_MODE === 'false'`)**:
   - Sends `POST /api/v1/assistant/run` to the local Python FastAPI backend (`http://127.0.0.1:8000/api/v1/assistant/run`).
   - Executes the real Pydantic AI `OFinanceAssistant` against Gemini (`gemini-2.5-pro` / `gemini-2.5-flash`) or `Local Ollama` and returns verified token usage, latency, and tool call traces (`executionOrigin: 'LOCAL_FASTAPI_GEMINI'`).

---

## 3. Task Modes (Configuration Profiles)

Task modes are typed configuration profiles passed into `OFinanceAssistant` at run time:

| Task Mode | Purpose | Accessible Tools | Expected Structured Output | Approval Policy |
| :--- | :--- | :--- | :--- | :--- |
| **`Accounting`** | Normalize feeds, match cross-account transfers, draft balanced Beancount postings. | `Read Accounts`, `Read Transactions`, `Read Beancount Ledger`, `Calculate FX`, `Calculate Cash Flow`, `Verify Double-Entry Balance`, `Generate Journal Draft`, `Request Human Approval`, `Record Audit Event` | `AccountingDraftResult` | Required if `confidence < 0.85` or before posting to `main.beancount`. |
| **`Portfolio Analysis`** | Aggregate multi-brokerage holdings, cost basis, unrealized P&L, and currency weights. | `Read Accounts`, `Read Holdings`, `Read Market Data`, `Calculate FX`, `Calculate Portfolio Returns`, `Generate Investment Analysis`, `Record Audit Event` | `PortfolioAnalysisResult` | Read-only advisory; human approval required for rebalancing escalations. |
| **`Research`** | Synthesize earnings, macro rate paths, and read-only reports from `daily_stock_analysis`. | `Read Holdings`, `Read Market Data`, `Read External Research Reports`, `Generate Research Report`, `Request Human Approval`, `Record Audit Event` | `ResearchBriefingResult` | Approval required if estimated task cost exceeds `$0.50 USD`. |
| **`Quantitative Research`** | Configure and evaluate parameterized DuckDB/Parquet strategy backtests. | `Read Market Data`, `Calculate Portfolio Returns`, `Calculate Risk Metrics`, `Run DuckDB Backtest`, `Request Human Approval`, `Record Audit Event` | `QuantExperimentResult` | Hard guardrail blocks leverage `> 1.0x` or live order routing. |
| **`Audit`** | Reconcile statement balances against Beancount assertions and detect duplicate fees. | `Read Accounts`, `Read Transactions`, `Read Beancount Ledger`, `Verify Double-Entry Balance`, `Request Human Approval`, `Record Audit Event` | `LedgerAuditResult` | Escalates all fee anomalies or stale connectors to Approval Inbox. |
| **`Risk Analysis`** | Monitor single-stock concentration (`12%` cap), sector weight (`40%` cap), and drawdown. | `Read Accounts`, `Read Holdings`, `Read Market Data`, `Calculate FX`, `Calculate Risk Metrics`, `Generate Investment Analysis`, `Request Human Approval`, `Record Audit Event` | `RiskAssessmentResult` | Automatic escalation to Approval Inbox when policy thresholds breach. |

---

## 4. Unified Model Configuration (`UnifiedModelConfig`)

All task modes share one global `UnifiedModelConfig` retrieved via `GET /api/v1/assistant/config`:

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

> When connected to the Phase 2 Local FastAPI backend with a valid `GEMINI_API_KEY`, the backend returns `"api_key_configured": true`, `"api_key_status": "Verified by Backend (GEMINI_API_KEY)"`, and `"model_status": "Connected (Backend Verified)"`.

---

## 5. Unified Tool Registry & Hard Prohibitions

### 5.1 Permitted Tool Categories
1. **Read-Only**: `Read Accounts`, `Read Transactions`, `Read Holdings`, `Read Market Data`, `Read Beancount Ledger`, `Read External Research Reports`
2. **Deterministic Computation**: `Calculate FX`, `Calculate Portfolio Returns`, `Calculate Cash Flow`, `Verify Double-Entry Balance`, `Calculate Risk Metrics`, `Run DuckDB Backtest`
3. **Drafting**: `Generate Journal Draft`, `Generate Research Report`, `Generate Investment Analysis`
4. **Governance**: `Request Human Approval`, `Record Audit Event`

### 5.2 Permanently Prohibited Operations
`OFinanceAssistant` is structurally prohibited from:
- Modifying or deleting raw financial transaction records.
- Posting unapproved Beancount journal entries directly to disk.
- Initiating bank wires, ACH transfers, or crypto withdrawals.
- Submitting live brokerage orders on Interactive Brokers, Charles Schwab, or Firstrade.
