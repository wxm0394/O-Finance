# Local Setup & Kali Linux Deployment Guide

## 1. Exporting from Google AI Studio to Kali Linux

```bash
git clone https://github.com/<your-username>/o-finance.git
cd o-finance
cp .env.example .env.local
```

## 2. Running the Desktop UI Prototype (Demo Mode)

```bash
npm install
npm run dev
```

Verify unit tests and TypeScript compilation:
```bash
npx --yes tsx --test src/utils/finance.test.ts
npm run lint
npm run build
```

## 3. Companion Local Services (Phase 2 Production Setup)

When transitioning from Demo Mode (`VITE_DEMO_MODE=true`) to your local Python stack on Kali Linux:

1. **Beancount & Fava**:
   ```bash
   pip install beancount fava
   fava ~/o-finance/ledger/main.beancount --port 5000
   ```
2. **Local Ollama Model Server**:
   ```bash
   ollama serve
   ollama pull qwen2.5-coder:32b
   ```
3. **Python FastAPI + Pydantic AI + DuckDB Backend**:
   Run on `http://127.0.0.1:8000` implementing the endpoints defined in `docs/API_CONTRACT.md`.
