# O-Finance AI Assistant Runtime Specification (`OFinanceAssistant` · v0.3)

## 1. Core Architectural Decision: Single Assistant Only

O-Finance v0.3 uses a **Single Assistant Architecture** built around one reusable **Pydantic AI** agent instance:

- **Assistant Identifier**: `OFinanceAssistant`
- **One Shared Pydantic AI Runtime**: No multi-agent swarm, no LangGraph state-machine complexity, and no specialist sub-agent instances.
- **One Primary LLM Provider & Shared Model Config**: All tasks share a single global model configuration (`Gemini`, `Claude`, `OpenAI-Compatible`, or optional global `Local Ollama`).
- **One Backend API Key**: Stored exclusively in the Python FastAPI backend environment (`OFINANCE_AI_API_KEY`) or OS keyring. Never exposed to frontend state, browser `localStorage`, or `VITE_` variables.
- **Zero Sub-Agent Delegation**: Instead of an orchestrator delegating to sub-agents, `OFinanceAssistant` switches between **Task Modes** (configuration profiles) and invokes deterministic tools sequentially.

---

## 2. Task Modes (Configuration Profiles)

Task modes are typed configuration profiles passed into `OFinanceAssistant` at run time via Pydantic AI's dynamic instructions, dependency injection, and toolset filtering:

| Task Mode | Purpose | Accessible Tools | Expected Structured Output | Approval Policy |
| :--- | :--- | :--- | :--- | :--- |
| **`Accounting`** | Normalize feeds, match cross-account transfers, draft balanced Beancount postings. | `Read Accounts`, `Read Transactions`, `Read Beancount Ledger`, `Calculate FX`, `Calculate Cash Flow`, `Verify Double-Entry Balance`, `Generate Journal Draft`, `Request Human Approval`, `Record Audit Event` | `AccountingDraftResult` | Required if `confidence < 0.85` or before posting to `main.beancount`. |
| **`Portfolio Analysis`** | Aggregate multi-brokerage holdings, cost basis, unrealized P&L, and currency weights. | `Read Accounts`, `Read Holdings`, `Read Market Data`, `Calculate FX`, `Calculate Portfolio Returns`, `Generate Investment Analysis`, `Record Audit Event` | `PortfolioAnalysisResult` | Read-only advisory; human approval required for rebalancing escalations. |
| **`Research`** | Synthesize earnings, macro rate paths, and read-only reports from `daily_stock_analysis`. | `Read Holdings`, `Read Market Data`, `Read External Research Reports`, `Generate Research Report`, `Request Human Approval`, `Record Audit Event` | `ResearchBriefingResult` | Approval required if estimated task cost exceeds `$0.50 USD`. |
| **`Quantitative Research`** | Configure and evaluate parameterized DuckDB/Parquet strategy backtests. | `Read Market Data`, `Calculate Portfolio Returns`, `Calculate Risk Metrics`, `Run DuckDB Backtest`, `Request Human Approval`, `Record Audit Event` | `QuantExperimentResult` | Hard guardrail blocks leverage `> 1.0x` or live order routing. |
| **`Audit`** | Reconcile statement balances against Beancount assertions and detect duplicate fees. | `Read Accounts`, `Read Transactions`, `Read Beancount Ledger`, `Verify Double-Entry Balance`, `Request Human Approval`, `Record Audit Event` | `LedgerAuditResult` | Escalates all fee anomalies or stale connectors to Approval Inbox. |
| **`Risk Analysis`** | Monitor single-stock concentration (`12%` cap), sector weight (`40%` cap), and drawdown. | `Read Accounts`, `Read Holdings`, `Read Market Data`, `Calculate FX`, `Calculate Risk Metrics`, `Generate Investment Analysis`, `Request Human Approval`, `Record Audit Event` | `RiskAssessmentResult` | Automatic escalation to Approval Inbox when policy thresholds breach. |

---

## 3. Unified Model Configuration

All task modes share one global `UnifiedModelConfig` retrieved via `GET /api/v1/assistant/config`:

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

---

## 4. Sequential Tool Execution Pattern

When a user submits a prompt in the **AI Assistant Center**, `OFinanceAssistant` executes deterministic tools sequentially:

```text
OFinanceAssistant [Accounting Mode]
  ├── Step 1: Read Transactions          (Read-Only)
  ├── Step 2: Calculate Cash Flow        (Deterministic Computation)
  ├── Step 3: Verify Double-Entry Balance(Deterministic Computation)
  └── Step 4: Generate Journal Draft     (Drafting -> Queued for Approval)
```

Every numerical figure returned in the final structured output comes directly from deterministic tool outputs—never from LLM estimation.

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
