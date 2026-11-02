# O-Finance System Architecture (v0.3)

## 1. Six-Layer Workstation Architecture

O-Finance is architected as a modular, local-first personal financial workstation separated into six explicit layers:

```text
+-----------------------------------------------------------------------------------+
| LAYER 1: DESKTOP WEB WORKSTATION UI (React 19 + TypeScript + Tailwind CSS)        |
| 11 Modules: Overview | Accounts | Transactions | Accounting | Portfolio | Market  |
|             Quant Lab | AI Assistant Center | Approvals | Audit | Settings        |
+-----------------------------------------------------------------------------------+
                                         |
                         Typed REST API (/api/v1/*) + Mock Adapter
                                         v
+-----------------------------------------------------------------------------------+
| LAYER 2: PYTHON FASTAPI APPLICATION GATEWAY & GOVERNANCE LAYER                    |
| AccountService | TransactionService | LedgerService | PortfolioService            |
| MarketDataService | ResearchService | AssistantService | ApprovalService | Audit  |
+-----------------------------------------------------------------------------------+
            |                                    |                           |
            v                                    v                           v
+------------------------+     +----------------------------------+   +-------------+
| LAYER 3: DETERMINISTIC |     | LAYER 4: SINGLE AI ASSISTANT     |   | LAYER 5:    |
| FINANCIAL & QUANT CORE |     | RUNTIME (OFinanceAssistant)      |   | READ-ONLY   |
| - Beancount + Fava     |     | - Shared Pydantic AI Instance    |   | CONNECTORS  |
| - Exact FX & P&L Math  |     | - 6 Task Mode Profiles           |   | - IBKR Flex |
| - DuckDB Backtester    |     | - 1 Unified Model & Backend Key  |   | - Schwab    |
+------------------------+     +----------------------------------+   | - Plaid/PSD2|
            \                                    |                    +-------------+
             \                                   |                           /
              v                                  v                          v
+-----------------------------------------------------------------------------------+
| LAYER 6: LOCAL SOVEREIGN STORAGE LAYER (Kali Linux Target)                        |
| - PostgreSQL 16: Normalized accounts, transactions, approvals, SHA-256 audit log  |
| - DuckDB + Apache Parquet: Historical OHLCV series, factor scores, backtest runs  |
| - Beancount Plain-Text Git Repo: Authoritative double-entry ledger (main.beancount)|
+-----------------------------------------------------------------------------------+
```

---

## 2. Single-Assistant Architecture (`OFinanceAssistant`)

In v0.3, O-Finance replaced the simulated 7-agent orchestration topology with a **Single Assistant Architecture**:

- **Central Assistant**: `OFinanceAssistant` (one shared Pydantic AI agent).
- **Task Modes**: `Accounting`, `Portfolio Analysis`, `Research`, `Quantitative Research`, `Audit`, and `Risk Analysis`.
- **Sequential Tool Execution**: Rather than spawning sub-agents or delegating across an agent graph, `OFinanceAssistant` loads the active Task Mode's system instructions and permitted tool subset, then invokes deterministic tools in sequence.
- **Unified Model & Key**: One global provider configuration (`Gemini`, `Claude`, `OpenAI-Compatible`, or `Local Ollama`) and one backend credential (`OFINANCE_AI_API_KEY`).

---

## 3. External Service Boundary: `daily_stock_analysis`

The external `daily_stock_analysis` project is treated strictly as an **independent external service** (`Daily Analysis Connector`):
- Communicates only via read-only HTTP (`GET http://127.0.0.1:8090/api/v1/reports`).
- Never shares database tables, Python runtime processes, or Beancount files with O-Finance.
- Clearly displays `Not Connected` when the external service is not running locally.
