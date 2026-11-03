# O-Finance — Private Financial Operating System (v0.3.2)

> **FRONTEND WORKSTATION & DETERMINISTIC DEMO ADAPTER (v0.3.2 — Final Frontend Contract Freeze)**
> This repository contains the **Frontend Workstation Prototype + Deterministic Demo Adapter (v0.3.2)** of **O-Finance**, a local-first Private Financial Operating System unifying multi-institution banking and brokerage accounts, Beancount double-entry accounting, portfolio risk analytics, DuckDB quantitative strategy backtesting, and a single Pydantic AI assistant (`OFinanceAssistant`) with human-in-the-loop governance.
>
> **Important Repository Scope Note (Phase 1 vs. Phase 2 Local Backend)**:
> - **Included in this repository (Phase 1 Complete)**: The complete 11-route React + TypeScript workstation UI, deterministic financial calculation engine (`src/utils/finance.ts`), automated test suite for both financial math and Demo Adapter (`src/utils/finance.test.ts` & `src/services/demoAdapter.test.ts`), per-currency Beancount Trial Balance verification, Dual-Mode normalized REST client (`src/services/index.ts` & `src/services/api/client.ts`), and the deterministic Demo Adapter (`executeDeterministicDemoAssistantRun`).
> - **Target for Phase 2 on Local Kali Linux (`backend/` — Not Yet Present in Repo)**: The Python 3.12 FastAPI + Pydantic AI + Gemini backend service (`backend/`), local Beancount/Fava daemon, and DuckDB Parquet store documented in [`docs/LOCAL_DEPLOYMENT.md`](./docs/LOCAL_DEPLOYMENT.md).

---

## 1. Core Architectural Principles

1. **Local-First Sovereignty**: Financial databases, Beancount plain-text ledgers, and API credentials reside on the operator's local workstation (Kali Linux / Debian target).
2. **Deterministic Financial Engine**: Balances, FX conversions (`USD`, `GBP`, `EUR`), per-currency double-entry trial balances (`calculateTrialBalance`), unrealized P&L, and backtest Sharpe/drawdown metrics are computed exclusively by deterministic TypeScript/Python functions (`src/utils/finance.ts`)—never by LLM mental arithmetic.
3. **Single Assistant Architecture (`OFinanceAssistant`)**:
   - **One AI Assistant Only**: `OFinanceAssistant` designed for a single shared **Pydantic AI** runtime.
   - **Six Task Mode Configuration Profiles**: `Accounting`, `Portfolio Analysis`, `Research`, `Quantitative Research`, `Audit`, and `Risk Analysis`.
   - **Phase 1 Single Cloud Provider (`Gemini`) & One Backend Key**: Phase 1 standardizes on **Google Gemini** (`gemini-2.5-pro` / `gemini-2.5-flash`) as the sole cloud LLM provider so all 6 task modes share a single backend `GEMINI_API_KEY` (`OFINANCE_AI_API_KEY`). `Local Ollama` remains an optional global offline mode. No multi-key management system, specialist sub-agent instances, or per-agent model routing exist.
   - **Honest API Key Verification & Dual-Mode Execution**:
     - In **Demo Mode** (`VITE_DEMO_MODE !== 'false'`), `api_key_configured` is strictly `false` (`Simulated / Unknown (Unverified in Demo Mode)`), and switching model presets only updates `provider`, `model`, and `base_url`.
     - `sendPlaygroundPrompt()` calls `AssistantService.runTask()`. In Demo Mode, the **Demo Adapter** computes live metrics dynamically from in-memory accounts, holdings, transactions, and journal entries via `src/utils/finance.ts` and records `0 real tokens / $0.00 real spend` (`tokensUsed: null`, `estimatedCostUSD: null`). When `VITE_DEMO_MODE=false`, `AssistantService.runTask()` dispatches `POST /api/v1/assistant/run` to the local FastAPI + Pydantic AI backend.
4. **Normalized API Client**: `ApiClient.resolveEndpointUrl()` safely handles both server root (`http://127.0.0.1:8000`) and prefixed (`http://127.0.0.1:8000/api/v1`) without double-prefixing `/api/v1/api/v1`.
5. **Read-Only Connectors by Default**: Bank and brokerage connectors (Interactive Brokers Flex, Charles Schwab Trader API, Plaid, TrueLayer, PSD2 AIS) are strictly read-only. Outbound wires, withdrawals, and live order placement are permanently disabled at the architecture level.
6. **Human-in-the-Loop Governance**: Low-confidence classifications (`confidence < 0.85`), unposted Beancount drafts, and concentration warnings require explicit operator approval in the **Approval Inbox**.
7. **External Service Isolation**: `daily_stock_analysis` is integrated strictly as an independent read-only HTTP connector (`Daily Analysis Connector`) with zero code or database merge.

---

## 2. Workstation Modules (11 Routes)

| Route | Module | Key Capabilities |
| :--- | :--- | :--- |
| `/` | **Overview** | Net worth reconciliation (`Cash + Investments - Liabilities`), 12M performance vs benchmark, cash flow, currency exposure (`USD/GBP/EUR`), account health, and activity inspector. |
| `/accounts` | **Accounts** | 6 multi-jurisdiction demo accounts (IBKR, Schwab, Firstrade, US/UK/EEA Banks) + 7 connector cards with simulated state cycling. |
| `/transactions` | **Transactions** | 32 normalized transactions, cross-account internal transfer matching (`XFER-2026-881`, `XFER-2026-742`), raw source JSON inspector, and CSV export. |
| `/accounting` | **Accounting** | 5-root Beancount chart of accounts, expandable journal entries, **per-currency Trial Balance verification** (USD, GBP, EUR), balance sheet, income statement, reconciliation table, and Fava placeholder modal. |
| `/portfolio` | **Portfolio** | 17 holdings across 4 accounts, concentration warnings, asset/sector/country/currency breakdown, dividend summary, and position drawer. |
| `/market-intelligence` | **Market Intelligence** | Global watchlist, fundamental/macro research briefings, economic calendar, and independent `Daily Analysis Connector` status panel. |
| `/quant-lab` | **Quant Lab** | 5 systematic strategy templates, parameterized deterministic backtest runner (commission & slippage bps), and 10 historical experiment logs. |
| `/agent-center` | **AI Assistant Center** | `OFinanceAssistant` playground (Dual-Mode `AssistantService.runTask()`), 6 Task Mode profiles, sequential deterministic tool timeline, Phase 1 Gemini + optional Local Ollama config, and 20-tool permission matrix. |
| `/approvals` | **Approval Inbox** | 10 human-in-the-loop governance tasks with inline Beancount draft editing, approve/reject controls, and live state updates. |
| `/audit` | **Audit & Security** | 10 constitutional security invariants and an append-only SHA-256 verification audit stream (`Assistant Execution`, `Connector Sync`, `Ledger Posting`, `Human Approval`). |
| `/settings` | **Settings** | Base currency, dark/light theme, browser API target endpoints, client-side `OFinanceAssistant` request budget, and snapshot export with clear browser session notices. |

---

## 3. Quick Start (Demo Mode, Unit Tests & CI)

```bash
# 1. Install frontend dependencies (Bun or npm)
bun install

# 2. Run deterministic unit tests (finance math + demo adapter)
bun run test

# 3. Start local development workstation on port 3000
bun run dev

# 4. Type-check and build production bundle
bun run lint
bun run build
```

---

## 4. Architecture & Operations Documentation

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — 6-layer system architecture, data stores, and deterministic boundary.
- [`docs/AGENT_RUNTIME.md`](./docs/AGENT_RUNTIME.md) — `OFinanceAssistant` single-assistant Pydantic AI design, Dual-Mode adapter boundary, and Phase 1 Gemini provider policy.
- [`docs/API_CONTRACT.md`](./docs/API_CONTRACT.md) — REST API specification with normalized base URLs and strict snake_case wire contracts.
- [`docs/SECURITY.md`](./docs/SECURITY.md) — 10 security invariants, backend vault credential isolation, and read-only enforcement.
- [`docs/LOCAL_DEPLOYMENT.md`](./docs/LOCAL_DEPLOYMENT.md) — Phase 2 Kali Linux local backend blueprint (FastAPI + Pydantic AI + Gemini, Beancount/Fava, DuckDB).
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — Phased engineering roadmap from v0.3.2 frontend freeze to Phase 2 local Kali Linux Python Harness.
