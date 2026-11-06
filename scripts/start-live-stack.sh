#!/usr/bin/env bash
set -e

# O-Finance Local Production Stack Startup Script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"

echo "=================================================="
echo "🚀 Starting O-Finance Local Production Stack"
echo "=================================================="

# 1. Start PostgreSQL via Docker Compose if docker-compose command is available
if command -v docker >/dev/null 2>&1 && command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1; then
  echo "📦 Ensuring PostgreSQL container is running..."
  docker compose up -d postgres 2>/dev/null || docker-compose up -d postgres 2>/dev/null || true
fi

# 2. Check Database Readiness (Wait up to 30s)
echo "🔍 Checking Database Connection..."
DB_READY=false
for i in {1..30}; do
  if command -v pg_isready >/dev/null 2>&1; then
    if pg_isready -h 127.0.0.1 -p 5432 -U ofinance_admin -d ofinance_core >/dev/null 2>&1; then
      DB_READY=true
      break
    fi
  else
    # Fallback TCP check on 5432
    if nc -z 127.0.0.1 5432 2>/dev/null || (exec 3<>/dev/tcp/127.0.0.1/5432) 2>/dev/null; then
      DB_READY=true
      break
    fi
  fi
  sleep 1
done

if [ "$DB_READY" = true ]; then
  echo "✅ PostgreSQL Database is operational."
  echo "🔄 Executing Alembic database migrations..."
  (cd backend && alembic upgrade head)
else
  echo "⚠️ PostgreSQL is not reachable at 127.0.0.1:5432. Proceeding with backend fallback mode."
fi

# 3. Launch FastAPI Backend Server (Port 8000)
echo "⚡ Starting FastAPI Backend on http://127.0.0.1:8000..."
(
  cd backend
  uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
)
BACKEND_PID=$!

# 4. Optional Launch Fava Beancount Daemon (Port 5000)
if command -v fava >/dev/null 2>&1; then
  echo "📊 Starting Fava Web UI on http://127.0.0.1:5000..."
  fava -H 127.0.0.1 -p 5000 ledger/main.beancount >/dev/null 2>&1 &
  FAVA_PID=$!
else
  echo "ℹ️ Fava CLI not found in PATH. Skipping Fava daemon launch."
fi

# 5. Launch Frontend Workstation (VITE_DEMO_MODE=false)
echo "🌐 Launching Frontend Workstation in Local FastAPI Mode (VITE_DEMO_MODE=false)..."
VITE_DEMO_MODE=false npm run dev
