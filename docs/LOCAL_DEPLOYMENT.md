# O-Finance Local Deployment Guide (Kali Linux / Debian Workstation · v0.3.1)

> **IMPORTANT IMPLEMENTATION STATUS (v0.3.1)**:
> - **Current Repository Contents (Phase 1 Complete)**: This repository currently contains the **Frontend Workstation (`src/`)**, deterministic financial math library (`src/utils/finance.ts`), unit test suite (`src/utils/finance.test.ts`), and the Dual-Mode API client (`src/services/index.ts`).
> - **Target Local Backend (`backend/` — Phase 2 Target Specification, Not Yet Present in Repo)**: The `backend/`, `ledger/`, and `data/` directories shown below represent the **Phase 2 Local Kali Linux Target Architecture** to be implemented after cloning this repository to your local Kali Linux workstation. Do not assume `backend/` is already bundled inside this frontend repository.

---

## 1. Target Local Directory Layout (Phase 2 on Kali Linux)

When setting up the full local stack on Kali Linux, organize the workspace as follows:

```text
~/o-finance/
├── frontend/                  # [PRESENT IN REPO] React + TypeScript + Vite workstation UI (v0.3.1)
├── backend/                   # [PHASE 2 TARGET — TO BE CREATED LOCALLY] Python 3.12 + FastAPI + Pydantic AI
│   ├── app/
│   │   ├── assistant/         # Single OFinanceAssistant (Pydantic AI) & 6 Task Mode profiles
│   │   ├── routers/           # /api/v1/assistant/*, /accounts, /ledger, /quant
│   │   ├── services/          # Deterministic financial & DuckDB engines
│   │   └── main.py
│   └── pyproject.toml
├── ledger/                    # [PHASE 2 TARGET — LOCAL LEDGER]
│   └── main.beancount         # Authoritative plain-text double-entry ledger
└── data/                      # [PHASE 2 TARGET — LOCAL DATA STORE]
    ├── ofinance.db            # PostgreSQL / SQLite transactional & audit store
    └── market_ohlcv.parquet   # DuckDB / Parquet quantitative research dataset
```

---

## 2. Phase 1 Single Cloud Provider & Backend Environment (`backend/.env`)

Phase 1 fixes **Google Gemini** (`gemini-2.5-pro` / `gemini-2.5-flash`) as the sole cloud LLM provider so that all 6 task modes of `OFinanceAssistant` share a single backend `GEMINI_API_KEY`. `Local Ollama` is supported as an optional global offline provider.

Store the Gemini API key exclusively in the Python backend environment (never in frontend `.env` or `VITE_` variables):

```ini
# Single Cloud AI Provider Configuration for OFinanceAssistant (Phase 1: Gemini)
OFINANCE_AI_PROVIDER="Gemini"
OFINANCE_AI_MODEL="gemini-2.5-pro"
OFINANCE_AI_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai"
GEMINI_API_KEY="YOUR_BACKEND_ONLY_GEMINI_API_KEY"
OFINANCE_AI_REQUEST_TIMEOUT=45
OFINANCE_AI_MAX_OUTPUT_TOKENS=4096
OFINANCE_AI_DAILY_BUDGET_USD=25.00
OFINANCE_AI_PER_TASK_BUDGET_USD=0.75

# Local Services
BEANCOUNT_FILE_PATH="/home/operator/o-finance/ledger/main.beancount"
FAVA_BASE_URL="http://127.0.0.1:5000"
DAILY_ANALYSIS_CONNECTOR_URL="http://127.0.0.1:8090/api/v1/reports"
```

### API Key Verification Contract (`GET /api/v1/assistant/config`)
- In **Demo Mode** (`VITE_DEMO_MODE=true`), the frontend never fakes `api_key_configured: true`. It displays `api_key_configured: false` and `Simulated / Unknown (Unverified in Demo Mode)`.
- Switching model presets in the UI only updates `provider`, `model`, and `base_url`.
- Only when the local FastAPI backend is running (`VITE_DEMO_MODE=false`) and validates a real `GEMINI_API_KEY` (or reachable local Ollama daemon) does `GET /api/v1/assistant/config` return `api_key_configured: true`.

---

## 3. Dual-Mode Switching (`Demo Adapter` vs. `Local FastAPI Backend`)

The frontend service layer (`src/services/index.ts`) supports two execution modes controlled by environment variables:

1. **Demo Adapter Mode (Default in Repo)**:
   - `VITE_DEMO_MODE=true` (or unset)
   - `AssistantService.runTask()` runs `executeDeterministicDemoAssistantRun()`, which computes real-time figures from the in-memory `accounts`, `holdings`, `transactions`, and `journalEntries` state via `src/utils/finance.ts` and records `tokensUsed: null` / `estimatedCostUSD: null`.
2. **Local FastAPI + Pydantic AI Mode (Phase 2 on Kali Linux)**:
   - Set `VITE_DEMO_MODE=false` and `VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1` when starting the frontend.
   - `AssistantService.runTask()` sends `POST http://127.0.0.1:8000/api/v1/assistant/run` to the local FastAPI + Pydantic AI + Gemini backend.

```bash
# 1. Start Beancount Fava web reporting server (Port 5000 — Phase 2 Local)
fava ~/o-finance/ledger/main.beancount --port 5000

# 2. Start Python FastAPI + Pydantic AI backend (Port 8000 — Phase 2 Local)
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# 3. Start O-Finance Frontend Workstation connected to Local FastAPI (Port 3000)
VITE_DEMO_MODE=false VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1 bun run dev
```
