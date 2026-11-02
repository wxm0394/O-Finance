# O-Finance Engineering Roadmap (v0.1 → v1.0)

## Phase 1: v0.1 — Desktop Workstation UI & Deterministic Financial Core (Completed)
- Built 11-route financial workstation UI with institutional dark/light themes.
- Implemented deterministic multi-currency (`USD`, `GBP`, `EUR`) net worth, cash flow, internal transfer matching, and DuckDB backtest simulator (`src/utils/finance.ts`).

## Phase 2: v0.2 — Workstation Refinement & Verification (Completed)
- Verified end-to-end mathematical reconciliation across Overview, Accounts, Portfolio, and Beancount Trial Balance (`0.00 USD` residual).
- Added unit test suite (`src/utils/finance.test.ts`) for deterministic financial logic.

## Phase 3: v0.3 — Single Assistant Architecture Refactor (`OFinanceAssistant`) (Current Release)
- Refactored AI layer from a simulated 7-agent topology to a single reusable **Pydantic AI** assistant (`OFinanceAssistant`).
- Defined 6 Task Mode configuration profiles (`Accounting`, `Portfolio Analysis`, `Research`, `Quantitative Research`, `Audit`, `Risk Analysis`) sharing one global LLM provider config and one backend API key.
- Redesigned **AI Assistant Center** with sequential deterministic tool execution timelines (`OFinanceAssistant → Tool 1 → Tool 2 → ...`), Unified Model Configuration, Unified Tool Registry, and Global AI Budget Monitor.
- Standardized backend contract on `/api/v1/assistant/*`.

## Phase 4: v0.4 — Local Kali Linux FastAPI & Beancount Runtime Integration (Planned)
- Connect frontend `ApiClient` (`VITE_DEMO_MODE=false`) to local Python FastAPI service on `127.0.0.1:8000`.
- Wire `LedgerService` to live `bean-check` and local Fava daemon on `127.0.0.1:5000`.
- Wire `ResearchService` to local DuckDB + Parquet OHLCV datasets and optional `daily_stock_analysis` read-only connector.
