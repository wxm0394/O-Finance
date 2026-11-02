# O-Finance — AI Agent Runtime & Governance Architecture (v0.2)

> **Architectural Boundary**: In the React/TypeScript Demo (`VITE_DEMO_MODE=true`), all agent executions, tool calls, and traces are **simulated** using deterministic local functions. The real **Pydantic AI** multi-agent runtime executes exclusively in the local **Python FastAPI Backend** (`http://127.0.0.1:8000`) when deployed on Kali Linux.

---

## 1. Core Design Philosophy

1. **Deterministic Math Only**: LLMs never compute account balances, FX conversions, portfolio returns, or trial balances by mental arithmetic. Every numerical calculation is delegated to typed Python/SQL/Beancount tools.
2. **Human-in-the-Loop Gate**: Agents cannot write directly to `main.beancount` or alter confirmed ledger states without operator approval when classification confidence is `< 0.85` or when an anomaly is flagged.
3. **Hard Read-Only Financial Boundary**: Outbound wires, ACH transfers, and live brokerage order placement tools are permanently excluded and locked out of the Agent Tool Registry.
4. **Provider-Independent Model Routing**: Each specialist agent can be independently routed to **Local Ollama** (`qwen2.5-coder:32b`, `deepseek-r1`), **Google Gemini** (`gemini-2.5-pro`), **Anthropic Claude**, or any **OpenAI-compatible** local vLLM endpoint.

---

## 2. Specialist Agent Roster (7 Agents)

| Agent ID | Name | Primary Role | Permitted Tools |
| :--- | :--- | :--- | :--- |
| `orchestrator` | **Orchestrator Agent** | Decomposes user queries, dispatches specialist agents, and synthesizes verified findings | `Read Accounts`, `Read Holdings`, `Request Human Approval` |
| `accounting` | **Accounting Agent** | Normalizes bank/brokerage feeds, links cross-account transfers, and drafts balanced Beancount entries | `Read Accounts`, `Read Transactions`, `Read Ledger`, `Generate Journal Draft`, `Request Human Approval` |
| `investment` | **Investment Agent** | Aggregates multi-brokerage positions, cost basis, dividend history, and currency exposure | `Read Accounts`, `Read Holdings`, `Read Market Data`, `Calculate Returns` |
| `research` | **Research Agent** | Synthesizes earnings, macro central bank policy, and read-only reports from `daily_stock_analysis` | `Read Holdings`, `Read Market Data`, `Create Research Report` |
| `quant` | **Quant Agent** | Configures parameterized strategy backtests against local DuckDB/Parquet OHLCV stores | `Read Market Data`, `Calculate Returns`, `Run Backtests` |
| `auditor` | **Auditor Agent** | Verifies statement balances against Beancount assertions, detects duplicate fees, and checks math integrity | `Read Accounts`, `Read Transactions`, `Read Ledger`, `Request Human Approval` |
| `risk` | **Risk Agent** | Monitors single-stock concentration (`>12%`), sector tilt (`>40%`), drawdown, and FX exposure | `Read Accounts`, `Read Holdings`, `Read Market Data`, `Calculate Returns`, `Request Human Approval` |

---

## 3. Pydantic AI Execution Lifecycle (Target Python Backend)

```text
[User Prompt / Sync Hook / Scheduled Cron]
                 │
                 ▼
      ┌──────────────────────┐
      │  Orchestrator Agent  │  (Pydantic AI Agent[OrchestratorDeps, OrchestratorOutput])
      └──────────┬───────────┘
                 │  Decomposes into typed sub-tasks
     ┌───────────┴───────────────┬──────────────────────────┐
     ▼                           ▼                          ▼
┌────────────────┐      ┌────────────────┐         ┌────────────────┐
│ Accounting Agt │      │ Investment Agt │         │  Auditor Agt   │
└───────┬────────┘      └───────┬────────┘         └───────┬────────┘
        │                       │                          │
        ▼                       ▼                          ▼
[Beancount Draft]     [Deterministic Math]       [Trial Balance Check]
        │
        ▼ (If confidence < 0.85 or anomaly)
┌────────────────────────────────────────┐
│ Human-in-the-Loop Approval Inbox (UI)  │
└────────────────────────────────────────┘
```

---

## 4. Telemetry, Budgets & Append-Only Audit

- **Per-Agent Daily Budget**: Enforced in USD equivalent (`agentDailyBudgetUSD`) and maximum steps per run (`agentMaxStepsPerRun = 8`).
- **Append-Only Execution Log**: Every prompt, tool call, token count, latency, and output summary is recorded in `agent_execution_logs` and cross-hashed into the Security & Audit Log (`AUD-*`).
