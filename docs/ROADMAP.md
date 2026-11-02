# O-Finance Development Roadmap

## Phase 1: Desktop UI Prototype & Service Architecture (v0.1 — Completed)
- [x] Establish dark institutional desktop workstation layout (`WorkstationShell`) with collapsible navigation and global search.
- [x] Implement all 11 core modules (`Overview`, `Accounts`, `Transactions`, `Accounting`, `Portfolio`, `Market Intelligence`, `Quant Lab`, `Agent Center`, `Approval Inbox`, `Audit & Security`, `Settings`).
- [x] Build deterministic TypeScript financial math engine (`src/utils/finance.ts`) with unit tests (`src/utils/finance.test.ts`) verifying cross-page reconciliation and internal transfer exclusion.
- [x] Create 10 modular service abstractions (`src/services/index.ts`) and unified API Client.

## Phase 2: Local Python FastAPI + Beancount/Fava Integration (v0.2)
- [ ] Bootstrap Python FastAPI server (`127.0.0.1:8000`) with PostgreSQL 16 and SQLAlchemy/Alembic migrations.
- [ ] Connect `LedgerService` to real local `main.beancount` file and live Fava instance (`127.0.0.1:5000`).
- [ ] Implement read-only IBKR Flex Web Service XML importer and GoCardless UK/EU Open Banking AIS sync workers.

## Phase 3: DuckDB Quant Engine & Pydantic AI Runtime (v0.3)
- [ ] Wire `Quant Lab` to local DuckDB + Parquet daily OHLCV store for vectorized multi-asset backtesting.
- [ ] Wire `Agent Center` to live Pydantic AI agents using local Ollama (`qwen2.5-coder`) and server-side Gemini/Claude models.
- [ ] Connect read-only `Daily Analysis Connector` to external `daily_stock_analysis` API.

## Phase 4: Tauri Desktop Packaging (v1.0)
- [ ] Wrap React frontend and local daemon health supervisor into a native Linux desktop binary via Tauri v2.
