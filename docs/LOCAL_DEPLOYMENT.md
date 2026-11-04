# O-Finance Local Deployment Guide (Kali Linux / Debian Workstation · v0.4.0)

> **IMPLEMENTATION STATUS (v0.4.0 · Phase 2.1 Backend Foundation Complete)**:
> - **Frontend Workstation (`src/`)**: React 19 + TypeScript + Vite, bilingual (EN/中文), supporting 4 base currencies (`USD`, `GBP`, `EUR`, `CNY`), and Dual-Mode API client (`src/services/index.ts`).
> - **Local Python Backend (`backend/` · Present in Repo)**: Python 3.12+ FastAPI application, Pydantic v2 snake_case DTOs, SQLAlchemy 2.x Async Engine + psycopg 3, Alembic migrations, and Default-Deny security guards.
> - **Target Local Stores**:
>   - PostgreSQL: Transactional records, accounts, approval tasks, and append-only SHA-256 audit logs.
>   - Beancount (`ledger/`): Authoritative plain-text double-entry ledger (Phase 2.2 integration).
>   - DuckDB + Parquet (`data/`): Analytical & quantitative research dataset (Phase 2.2 integration).

---

## 1. Directory Structure

```text
o-finance/
├── src/                       # React 19 + TypeScript + Vite workstation UI (v0.4.0)
├── backend/                   # Python 3.12 + FastAPI + SQLAlchemy 2.x + Pydantic v2
│   ├── app/
│   │   ├── main.py            # FastAPI entry point, CORS, /healthz
│   │   ├── core/              # Config (pydantic-settings), Security Guard (Default-Deny), Database (SQLAlchemy 2.x)
│   │   ├── api/v1/            # /api/v1/assistant/* (status, config, run)
│   │   ├── schemas/           # Pydantic v2 DTOs (snake_case)
│   │   ├── models/            # SQLAlchemy 2.x models (PostgreSQL)
│   │   ├── services/          # Assistant & Health probe services
│   │   ├── assistant/         # OFinanceAssistantRuntime scaffold (Pydantic AI)
│   │   └── ledger/            # Beancount plain-text bridge scaffold
│   ├── migrations/            # Alembic async migration suite
│   ├── tests/                 # pytest suite (health, status, config, run, db, security)
│   ├── pyproject.toml         # Python packaging & tool configuration
│   └── .env.example           # Backend environment template
├── ledger/                    # [Local Ledger] Authoritative main.beancount
└── data/                      # [Local Data Store] Parquet & DuckDB market data
```

---

## 2. Backend Setup & Configuration (`backend/.env`)

The backend uses **Google Gemini** (`gemini-2.5-pro` / `gemini-2.5-flash`) as the sole cloud LLM provider, with all 6 task modes of `OFinanceAssistant` sharing a single backend `GEMINI_API_KEY`. `Local Ollama` is supported as an optional global offline provider.

Store the Gemini API key exclusively in the Python backend environment (`backend/.env` — never in frontend `.env` or `VITE_` variables):

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env`:
```ini
APP_ENV=development
APP_HOST=127.0.0.1
APP_PORT=8000
LOG_LEVEL=INFO

# Local PostgreSQL Connection
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/ofinance_db

# AI Provider (Gemini or Local Ollama)
LLM_PROVIDER=Gemini
GEMINI_API_KEY=YOUR_BACKEND_ONLY_GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-flash

# If using Local Ollama:
# LLM_PROVIDER="Local Ollama"
# OLLAMA_BASE_URL="http://127.0.0.1:11434"
# OLLAMA_MODEL="qwen2.5:14b"
```

### Run Migrations & Start Backend

```bash
# Run PostgreSQL migrations
alembic upgrade head

# Start FastAPI backend server (Port 8000)
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 3. Dual-Mode Switching (`Demo Adapter` vs. `Local FastAPI Backend`)

The frontend service layer (`src/services/index.ts`) supports two execution modes:

1. **Demo Adapter Mode (Default)**:
   - `VITE_DEMO_MODE=true` (or unset)
   - `AssistantService.runTask()` runs deterministic in-memory calculations via `src/utils/finance.ts`, across all 4 base currencies (`USD`, `GBP`, `EUR`, `CNY`).
2. **Local FastAPI Backend Mode**:
   - Set `VITE_DEMO_MODE=false` and `VITE_API_BASE_URL=http://127.0.0.1:8000`.
   - `AssistantService.runTask()` sends requests to `POST http://127.0.0.1:8000/api/v1/assistant/run`.

```bash
# Start Frontend connected to Local Backend
VITE_DEMO_MODE=false VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```
