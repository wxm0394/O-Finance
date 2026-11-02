# O-Finance — Local Kali Linux Deployment Guide (v0.2)

> This guide explains how to export the O-Finance frontend from AI Studio / GitHub and deploy the complete local-first stack on **Kali Linux** (or Debian/Ubuntu workstations).

---

## 1. Local Workstation Topology

All services bind exclusively to `127.0.0.1` (loopback) by default so no financial data is exposed to external networks:

| Component | Technology | Default Local Binding | Purpose |
| :--- | :--- | :--- | :--- |
| **Desktop / Web UI** | React 19 + TypeScript + Vite / Tauri | `http://127.0.0.1:3000` | Interactive Financial Workstation UI |
| **Core API & Agent Host** | Python 3.12 + FastAPI + Pydantic AI | `http://127.0.0.1:8000` | REST API, Connector Vault, Agent Runtime |
| **Double-Entry Ledger UI** | Beancount v3 + Fava | `http://127.0.0.1:5000` | Authoritative Double-Entry Accounting & Reports |
| **Transactional DB** | PostgreSQL 16 | `127.0.0.1:5432` | Normalized transactions, audit logs, approval tasks |
| **Quant Analytical Store** | DuckDB + Apache Parquet | `~/o-finance/quant/*.parquet` | Vectorized OHLCV market data & backtest registry |
| **Local LLM Server** | Ollama / vLLM | `http://127.0.0.1:11434` | Local privacy-preserving inference (`qwen2.5-coder:32b`) |
| **External Research Feed** | `daily_stock_analysis` (Optional) | `http://127.0.0.1:8090` | Read-only external stock report ingestion |

---

## 2. Step-by-Step Setup on Kali Linux

### 2.1 Clone & Run Frontend in Demo Mode
```bash
git clone <your-private-repo-url> o-finance
cd o-finance
npm install
npm run dev
```
Verify unit tests and production bundle:
```bash
npx --yes tsx --test src/utils/finance.test.ts
npm run lint
npm run build
```

### 2.2 Initialize Beancount & Fava Local Service
```bash
sudo apt update && sudo apt install -y python3-venv python3-pip postgresql
mkdir -p ~/o-finance/ledger ~/o-finance/quant
python3 -m venv ~/o-finance/.venv
source ~/o-finance/.venv/bin/activate
pip install beancount fava fastapi uvicorn pydantic-ai duckdb polars psycopg[binary]

# Start Fava on loopback port 5000
fava ~/o-finance/ledger/main.beancount --host 127.0.0.1 --port 5000
```

### 2.3 Connect Frontend to Local Python FastAPI Backend
Create `.env.local` in the frontend root:
```env
VITE_DEMO_MODE="false"
VITE_API_BASE_URL="http://127.0.0.1:8000"
VITE_FAVA_URL="http://127.0.0.1:5000"
```
> **Security Rule**: Never place Interactive Brokers Flex tokens, Charles Schwab OAuth secrets, Plaid keys, or LLM API keys inside `.env.local` or any `VITE_*` variable. All credentials belong exclusively in the Python backend's encrypted environment or OS keyring.
