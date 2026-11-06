# Stage 1: Build Vite React SPA Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Full-Stack Production Container (FastAPI + SPA Static Mount)
FROM python:3.12-slim AS runner
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend source code, ledger files, and built frontend SPA assets
COPY backend/app /app/backend/app
COPY backend/pyproject.toml /app/backend/pyproject.toml
COPY ledger /app/ledger
COPY --from=frontend-builder /app/dist /app/backend/app/static

ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    USE_SQLITE_FALLBACK=true \
    SQLITE_DB_PATH=/app/ofinance_portable.db

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
