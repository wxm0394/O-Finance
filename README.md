# O-Finance — Private Financial Operating System (v0.3)

> **DEMO MODE · SIMULATED FINANCIAL DATA**
> This repository contains the Desktop Web Workstation Prototype (v0.3) of **O-Finance**, a local-first Private Financial Operating System unifying multi-institution banking and brokerage accounts, Beancount double-entry accounting, portfolio risk analytics, DuckDB quantitative strategy backtesting, and a single Pydantic AI assistant (`OFinanceAssistant`) with human-in-the-loop governance.

---

## 1. Core Architectural Principles

1. **Local-First Sovereignty**: Financial databases, Beancount plain-text ledgers, and API credentials reside on the operator's local workstation (Kali Linux / Debian target).
2. **Deterministic Financial Engine**: Balances, FX conversions (`USD`, `GBP`, `EUR`), double-entry trial balances, unrealized P&L, and backtest Sharpe/drawdown metrics are computed exclusively by deterministic TypeScript/Python functions (`src/utils/finance.ts`)—never by LLM mental arithmetic.
3. **Single Assistant Architecture (`OFinanceAssistant`)**:
   - **One AI Assistant Only**: `OFinanceAssistant` powered by a single shared **Pydantic AI** runtime.
   - **Six Task Mode Configuration Profiles**: `Accounting`, `Portfolio Analysis`, `Research`, `Quantitative Research`, `Audit`, and `Risk Analysis`.
   - **One Shared Model & API Key**: All task modes share one primary LLM provider configuration (`Gemini`, `Claude`, `OpenAI-Compatible`, or optional global `Local Ollama`) and one backend-only API key (`OFINANCE_AI_API_KEY`). No specialist sub-agent instances, no orchestrator-to-subagent delegation, and no per-agent model/key routing exist.
4. **Read-Only Connectors by Default**: Bank and brokerage connectors (Interactive Brokers Flex, Charles Schwab Trader API, Plaid, TrueLayer, PSD2 AIS) are strictly read-only. Outbound wires, withdrawals, and live order placement are permanently disabled at the architecture level.
5. **Human-in-the-Loop Governance**: Low-confidence classifications (`confidence < 0.85`), unposted Beancount drafts, and concentration warnings require explicit operator approval in the **Approval Inbox**.
6. **External Service Isolation**: `daily_stock_analysis` is integrated strictly as an independent read-only HTTP connector (`Daily Analysis Connector`) with zero code or database merge.

---

## 2. Workstation Modules (11 Routes)

| Route | Module | Key Capabilities |
| :--- | :--- | :--- |
| `/` | **Overview** | Net worth reconciliation (`Cash + Investments - Liabilities`), 12M performance vs benchmark, cash flow, currency exposure (`USD/GBP/EUR`), account health, and activity inspector. |
| `/accounts` | **Accounts** | 6 multi-jurisdiction demo accounts (IBKR, Schwab, Firstrade, US/UK/EEA Banks) + 7 connector cards with simulated state cycling. |
| `/transactions` | **Transactions** | 32 normalized transactions, cross-account internal transfer matching (`XFER-2026-881`, `XFER-2026-742`), raw source JSON inspector, and CSV export. |
| `/accounting` | **Accounting** | 5-root Beancount chart of accounts, expandable journal entries, trial balance (`0.00 USD` residual), balance sheet, income statement, reconciliation table, and Fava placeholder modal. |
| `/portfolio` | **Portfolio** | 17 holdings across 4 accounts, concentration warnings, asset/sector/country/currency breakdown, dividend summary, and position drawer. |
| `/market-intelligence` | **Market Intelligence** | Global watchlist, fundamental/macro research briefings, economic calendar, and independent `Daily Analysis Connector` status panel. |
| `/quant-lab` | **Quant Lab** | 5 systematic strategy templates, parameterized deterministic backtest runner (commission & slippage bps), and 10 historical experiment logs. |
| `/agent-center` | **AI Assistant Center** | `OFinanceAssistant` playground, 6 Task Mode configuration profiles, sequential deterministic tool timeline, unified model & budget config, and 20-tool permission matrix. |
| `/approvals` | **Approval Inbox** | 10 human-in-the-loop governance tasks with inline Beancount draft editing, approve/reject controls, and live state updates. |
| `/audit` | **Audit & Security** | 10 constitutional security invariants and an append-only SHA-256 verification audit stream. |
| `/settings` | **Settings** | Base currency, dark/light theme, FastAPI/Fava/Beancount paths, global `OFinanceAssistant` daily budget, and snapshot export. |

---

## 3. Quick Start (Demo Mode & Unit Tests)

```bash
# 1. Install frontend dependencies
npm install

# 2. Run deterministic financial math unit tests (node:test)
npx tsx --test src/utils/finance.test.ts

# 3. Start local development workstation on port 3000
npm run dev

# 4. Type-check and build production bundle
npm run lint
npm run build
```

---

## 4. Architecture & Operations Documentation

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — 6-layer system architecture, data stores, and deterministic boundary.
- [`docs/AGENT_RUNTIME.md`](./docs/AGENT_RUNTIME.md) — `OFinanceAssistant` single-assistant Pydantic AI design, 6 Task Modes, and sequential tool execution.
- [`docs/API_CONTRACT.md`](./docs/API_CONTRACT.md) — REST API specification including `/api/v1/assistant/*` endpoints.
- [`docs/SECURITY.md`](./docs/SECURITY.md) — 10 security invariants, backend vault credential isolation, and read-only enforcement.
- [`docs/LOCAL_DEPLOYMENT.md`](./docs/LOCAL_DEPLOYMENT.md) — Kali Linux local deployment guide (FastAPI, PostgreSQL, DuckDB, Beancount/Fava).
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — Phased engineering roadmap from v0.1/v0.3 prototype to local Kali Linux production.
