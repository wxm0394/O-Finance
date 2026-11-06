# O-Finance Engineering Roadmap (v0.1 → v1.0)

## Phase 1: v0.1 - v0.3 — Frontend Workstation & Deterministic Financial Core (Completed)
- Built 11-route financial workstation UI with bilingual localization (EN/中文) and 4 base currencies (`USD`, `GBP`, `EUR`, `CNY`).
- Implemented deterministic financial math, multi-currency trial balance reconciliation, cash flow, internal transfer matching, and deterministic backtesting (`src/utils/finance.ts`).
- Standardized AI Assistant architecture on a single `OFinanceAssistant` runtime with 6 task modes and Dual-Mode execution (`Demo Adapter` vs. `Local FastAPI`).

## Phase 2.1: v0.4.0 — Backend Foundation (Completed)
- Established `backend/` Python 3.12+ infrastructure with FastAPI, Pydantic v2, SQLAlchemy 2.x Async Engine, psycopg 3, and Alembic migrations.
- Implemented `/healthz`, `/api/v1/assistant/status`, `/api/v1/assistant/config`, and `/api/v1/assistant/run` scaffold.
- Configured secret isolation (no `GEMINI_API_KEY` sent to frontend or logs) and Local Ollama support.

## Phase 2.1.1: Backend Hardening (Completed)
- Enforced Default-Deny permission security guard across all 6 task modes.
- Established canonical `/healthz` sub-systems (`postgres`, `gemini_api_key`, `gemini_model`, `ollama`) and separated configuration from live probe verification.
- Enforced strict database connection timeout via `asyncio.wait_for`.
- Added GitHub Actions `backend-test` CI job.

## Phase 2.1.2: Backend Verification & Security Closure (Completed)
- **CI & Packaging Fix**: Configured `[tool.setuptools.packages.find]` in `pyproject.toml` to prevent flat-layout package discovery errors (`migrations` & `tests` excluded).
- **Authoritative Approval Verification**: Implemented `ApprovalService` to query real `ApprovalTaskModel` database records; caller-supplied status strings are strictly rejected; enforced one-time consumption (anti-replay), expiration checks, and task mode/action/target/payload binding.
- **Automated Audit Hash Chaining**: Implemented `AuditService.append_entry` with row-level locking (`SELECT ... FOR UPDATE`), automated `prev_hash` linkage, full chain verification (`verify_database_chain`), and explicit threat model documentation.
- **Database Probe Timeout Tests**: Automated testing of normal connections, unconfigured states, and hanging query timeouts with resource cleanup.

## Phase 2.2: Pydantic AI Harness & Beancount Runtime Integration (Completed)
- Wire `OFinanceAssistantRuntime` in `backend/app/assistant/runtime.py` with real Pydantic AI agent, tool registries, and Gemini 2.5 streaming.
- Implement formal Beancount plain-text accounting bridge in `backend/app/ledger/beancount_bridge.py` interfacing with `bean-check` and Fava daemon.
- Maintain PostgreSQL as transactional, approval, and audit store; Beancount as the sole double-entry source of truth.
- Expose ApprovalService, AuditService, and BeancountBridge via FastAPI routes under `/api/v1`.

## Phase 2.3: DuckDB + Parquet Analytical Engine (Completed)
- Implemented analytical store in `backend/app/quant/backtest_engine.py` with DuckDB + Parquet OHLCV queries and deterministic synthetic data fallback.
- Built 5 quantitative strategies: `ma_crossover`, `cross_sectional_momentum`, `bollinger_rsi_mean_reversion`, `multi_asset_donchian`, `quality_low_vol_fcf`.
- Exposed `/api/v1/quant/strategies` and `/api/v1/quant/backtest` with friction cost deduction and audit logging.
- Implemented external research connector in `backend/app/connectors/daily_analysis_connector.py` with loopback validation and graceful fallback.
- Exposed `/api/v1/market-intelligence/connector-status` and `/api/v1/market-intelligence/reports` with security boundary enforcement.

## Phase 3: Cross-Platform Desktop Shell, Portable Snapshot & Full-Stack Containerization (Completed)
- **Linux Desktop Workstation Shell**: Created Electron main process (`desktop/main.cjs`), preload script (`desktop/preload.cjs`), Fava daemon supervisor, and Linux `.desktop` application launcher installer (`scripts/install-desktop-entry.sh`).
- **SQLite Dual-Engine Fallback**: Implemented automatic SQLite database fallback (`use_sqlite_fallback`) in `backend/app/core/database.py` with dynamic schema initialization (`init_db_schema()`).
- **Portable Snapshot System**: Implemented `/api/v1/system/export-snapshot`, `/api/v1/system/verify-snapshot`, and `/api/v1/system/restore-snapshot` with Fail-Closed cryptographic integrity validation and OS atomic file swapping.
- **Frontend Runtime Mode Switcher**: Added dynamic hot-switching between `DEMO` and `LOCAL_FASTAPI` backend runtime modes with persistent storage.
- **Full-Stack Containerization**: Created root multi-stage `Dockerfile` (Vite production build + Python FastAPI backend) and production `docker-compose.yml` with PostgreSQL DB service.
- **Release Hardening**: Resolved literal `~` directory creation bug, isolated test ledger paths via temporary files (`tmp_path`), and completed live mode CSV statement import and HITL approval execution loop.
