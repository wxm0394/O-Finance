# O-Finance System Architecture

## 1. Architectural Vision

O-Finance is designed as a **Local-First Personal Financial Operating System**. The current repository provides the complete **Desktop UI Prototype (v0.1)** with a clean Service & API Client abstraction layer (`src/services/`) so the frontend can transition seamlessly from the deterministic Mock Adapter to the local Python FastAPI backend on Kali Linux.

| Layer | Technology | Primary Responsibility |
|---|---|---|
| **Desktop UI** | React 19 + TypeScript + Tailwind CSS | High-density financial workstation & governance cockpit |
| **Desktop Shell** | Tauri (Planned Phase 2) | Native Linux/macOS windowing & local process supervision |
| **API Backend** | Python 3.12 + FastAPI | REST API contract, connector orchestration, deterministic math |
| **AI Harness** | Pydantic AI | Type-safe multi-agent runtime, tool validation, budget caps |
| **Workflow** | Pydantic AI / LangGraph | Multi-step research & reconciliation state machines |
| **Accounting** | Beancount | Authoritative plain-text double-entry accounting ledger |
| **Accounting UI** | Fava | Dedicated web interface for Beancount reports (`127.0.0.1:5000`) |
| **Main Database** | PostgreSQL 16 | Normalized transactions, connector state, append-only audit logs |
| **Analytics & Quant** | DuckDB + Apache Parquet | Vectorized OHLCV storage, factor research, backtest engine |
| **Local Models** | Ollama (`qwen2.5-coder`, `deepseek-r1`) | Local privacy-preserving inference |
| **Cloud Models** | Gemini / Claude / OpenAI-Compatible | Optional high-context cloud synthesis via server-side proxy |

---

## 2. Deterministic Financial Computation Invariant

A core architectural law of O-Finance is **Deterministic Finance**:
- Account balances, multi-currency FX conversions (`USD`, `GBP`, `EUR`), unrealized/realized P&L, portfolio weights, and backtest Sharpe/drawdown metrics are **always** computed by deterministic functions (`src/utils/finance.ts` in Demo Mode; Python Decimal/Polars/DuckDB in Production).
- Large Language Models (LLMs) are **never** allowed to perform mental arithmetic on balances or fabricate account state.

---

## 3. External Service Boundaries

1. **Beancount + Fava**: O-Finance acts as the unified ingestion, normalization, AI classification, and human-approval gateway that appends verified entries to `main.beancount`. Fava runs as a companion process for deep accounting statements.
2. **Daily Analysis Connector (`daily_stock_analysis`)**: Treated strictly as an independent external read-only service. O-Finance never merges its codebase, duplicates its database, or re-implements its internal analysis pipeline.
