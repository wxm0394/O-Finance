# O-Finance Local Deployment Guide (Kali Linux / Debian Workstation · v0.3)

This guide explains how to export O-Finance from the cloud Demo prototype to a local Kali Linux workstation and connect the Python FastAPI backend, Beancount/Fava ledger, DuckDB quant store, and the single `OFinanceAssistant` Pydantic AI runtime.

---

## 1. Local Directory Layout

```text
~/o-finance/
├── frontend/                  # This React + TypeScript + Vite workstation UI
├── backend/                   # Python 3.12 + FastAPI + Pydantic AI service
│   ├── app/
│   │   ├── assistant/         # Single OFinanceAssistant & 6 Task Mode profiles
│   │   ├── routers/           # /api/v1/assistant/*, /accounts, /ledger, /quant
│   │   ├── services/          # Deterministic financial & DuckDB engines
│   │   └── main.py
│   └── pyproject.toml
├── ledger/
│   └── main.beancount         # Authoritative plain-text double-entry ledger
└── data/
    ├── ofinance.db            # PostgreSQL / SQLite transactional & audit store
    └── market_ohlcv.parquet   # DuckDB / Parquet quantitative research dataset
```

---

## 2. Backend Environment Variables (`backend/.env`)

Store the single cloud LLM API key exclusively in the backend environment (never in frontend `.env` or `VITE_` variables):

```ini
# Single AI Provider Configuration for OFinanceAssistant
OFINANCE_AI_PROVIDER="Gemini"
OFINANCE_AI_MODEL="gemini-2.5-pro"
OFINANCE_AI_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai"
OFINANCE_AI_API_KEY="YOUR_BACKEND_ONLY_API_KEY"
OFINANCE_AI_REQUEST_TIMEOUT=45
OFINANCE_AI_MAX_OUTPUT_TOKENS=4096
OFINANCE_AI_DAILY_BUDGET_USD=25.00
OFINANCE_AI_PER_TASK_BUDGET_USD=0.75

# Local Services
BEANCOUNT_FILE_PATH="/home/operator/o-finance/ledger/main.beancount"
FAVA_BASE_URL="http://127.0.0.1:5000"
DAILY_ANALYSIS_CONNECTOR_URL="http://127.0.0.1:8090/api/v1/reports"
```

---

## 3. Running the Local Stack on Kali Linux

```bash
# 1. Start Beancount Fava web reporting server (Port 5000)
fava ~/o-finance/ledger/main.beancount --port 5000

# 2. Start Python FastAPI + Pydantic AI backend (Port 8000)
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# 3. Start O-Finance Frontend Workstation (Port 3000)
npm install
npm run dev
```
