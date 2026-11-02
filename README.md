# O-Finance — Personal Financial Operating System

> **DEMO MODE · SIMULATED FINANCIAL DATA**
> Current Version: **Desktop UI Prototype v0.1**
> All accounts, balances, transactions, Beancount journal entries, portfolio holdings, quant backtest metrics, and AI Agent traces in this prototype use fictional simulation data. No real financial institutions or live trading APIs are connected.

---

## 1. What is O-Finance?

**O-Finance** is a local-first **Personal Financial Operating System** engineered for individuals managing multi-jurisdiction bank accounts (US, UK, EEA), multi-brokerage investment portfolios (Interactive Brokers, Charles Schwab, Firstrade), plain-text double-entry accounting (**Beancount + Fava**), systematic quantitative research (**DuckDB + Parquet**), and governed **Pydantic AI** specialist agents.

Unlike consumer budgeting apps or standalone stock tickers, O-Finance unifies:
1. **Multi-Institution Account Aggregation** (Read-only by default across USD, GBP, and EUR).
2. **Authoritative Double-Entry Accounting** (Beancount ledger syntax + Fava web UI integration + Transfer Linking to prevent double-counting internal transfers).
3. **Institutional Portfolio Analytics** (Asset allocation, sector/country/currency exposure, correlation, and single-stock concentration guardrails).
4. **Market Intelligence & Read-Only External Connectors** (Including a strict boundary placeholder for `daily_stock_analysis`).
5. **Quantitative Research Lab** (Parameterized strategy simulation, equity/drawdown curves, and experiment registry).
6. **Multi-Agent AI Control Center** (7 specialist agents coordinated by an Orchestrator with explicit tool permission gates).
7. **Human-in-the-Loop Approval Inbox & Append-Only Audit Trail**.

---

## 2. Current Demo Features (v0.1)

- **11 Dedicated Workstation Modules** with full React Router navigation:
  1. `Overview` — Executive Financial Cockpit with 7 wealth metrics, base currency switcher (`USD` / `GBP` / `EUR`), 5 interactive Recharts visualizations (`1W` to `ALL`), Account Health panel, and clickable Recent Activity inspector.
  2. `Accounts` — 6 simulated multi-currency accounts, 6 read-only connector cards (IBKR, Schwab, Firstrade, US/UK/EEA Banks), simulated authorization modal, and automatic sync scheduler.
  3. `Transactions` — 30+ normalized records across 12 transaction types, cross-account **Transfer Linking** (`XFER-2026-881`, `XFER-2026-742`), multi-criteria filtering, sorting, pagination, and raw feed JSON + Beancount modal inspector.
  4. `Accounting` — Beancount 5-root Chart of Accounts tree, 7-stage automated bookkeeping pipeline, expandable double-entry journal viewer, and Fava placeholder integration (`http://127.0.0.1:5000`).
  5. `Portfolio` — 17 holdings across IBKR, Schwab, Firstrade, and EU Depot (`$616,572.00 USD` total matching Overview 100%), sector/country exposure, Top 10 concentration audit, and lot history viewer.
  6. `Market Intelligence` — Global index snapshot, core watchlist, macro economic calendar, research briefings, and read-only placeholder for `Daily Analysis Connector`.
  7. `Quant Lab` — 5 quantitative strategies, interactive backtest runner, equity/drawdown/monthly return charts, and 10+ experiment records.
  8. `Agent Center` — 7 agents (`Orchestrator`, `Accounting`, `Investment`, `Research`, `Quant`, `Auditor`, `Risk`), multi-step Playground call chain trace, model routing selector (`Local Ollama`, `Gemini`, `Claude`, `OpenAI-Compatible`), and tool permission matrix with hard read-only locks.
  9. `Approval Inbox` — 10 human-in-the-loop review tasks with Approve, Reject, and live Beancount draft editing.
  10. `Audit & Security` — 10 constitutional security invariants and 20+ append-only SHA-256 audit logs that update live as you interact with the app.
  11. `Settings` — Persistent local demo configuration (Base Currency, Dark/Light Theme, Sync Frequency, FastAPI/Fava URLs, Agent Budgets).

---

## 3. Quick Start & Local Development

### Prerequisites
- Node.js 20+ and npm

### Install & Run
```bash
npm install
npm run dev
```
The workstation will start at `http://localhost:3000`.

### Run Deterministic Unit Tests & Build Verification
```bash
npx --yes tsx --test src/utils/finance.test.ts
npm run lint
npm run build
```

---

## 4. Switching from Demo Mode to Local Python FastAPI Backend

By default, O-Finance runs in Demo Mode using deterministic local services:
```env
VITE_DEMO_MODE="true"
VITE_API_BASE_URL="http://127.0.0.1:8000"
VITE_FAVA_URL="http://127.0.0.1:5000"
```
When deploying on Kali Linux alongside the Python FastAPI backend (`docs/API_CONTRACT.md`), set `VITE_DEMO_MODE="false"` in `.env.local`. Never place banking passwords, brokerage OAuth secrets, or API keys in `VITE_` variables.

---

## 5. Documentation Index

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Target Full-Stack Architecture (React + Tauri + FastAPI + Pydantic AI + Beancount/Fava + PostgreSQL + DuckDB).
- [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) — REST API specification between the React Frontend and Python FastAPI Backend.
- [`docs/SECURITY.md`](docs/SECURITY.md) — Read-Only Connector Policy, Credential Isolation, and Human-in-the-Loop Governance.
- [`docs/LOCAL_SETUP.md`](docs/LOCAL_SETUP.md) — Kali Linux Local Deployment Guide (FastAPI, Fava, PostgreSQL, DuckDB, Ollama).
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — Multi-phase engineering roadmap from v0.1 Prototype to v1.0 Local Workstation.
