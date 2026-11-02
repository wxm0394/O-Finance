# O-Finance Security, Credential Isolation & Governance Policy (v0.3)

## 1. Ten Constitutional Security Invariants

1. **Read-Only Financial Connectors by Default**: Bank and brokerage integrations (IBKR Flex, Schwab Trader, Plaid, TrueLayer, PSD2 AIS) are restricted to read-only scopes.
2. **Single Backend AI Credential (`OFINANCE_AI_API_KEY`)**: All cloud LLM tasks across `OFinanceAssistant` share a single API credential stored in the Python backend environment or OS credential store (`libsecret` / Kali Linux keyring).
3. **Zero Frontend Secret Exposure**: API keys, brokerage tokens, and bank credentials must never be stored in React state, `localStorage`, `sessionStorage`, or `VITE_*` environment variables.
4. **LLM Credential Isolation**: `OFinanceAssistant` never receives raw banking credentials, OAuth refresh tokens, or API keys in its prompt context or tool responses.
5. **Non-Bypassable Tool Permission Matrix**: Every tool call invoked by `OFinanceAssistant` is validated against the active Task Mode's allowed toolset and the global Tool Permission Matrix.
6. **Immutable Raw Financial Feed**: Raw institution statements and transaction payloads are stored append-only; `OFinanceAssistant` can only propose normalized mappings or unposted Beancount drafts.
7. **Human-in-the-Loop Ledger Gate**: Any Beancount journal draft with classification `confidence < 0.85` or risk policy breach is held in the **Approval Inbox** until explicitly approved by the human operator.
8. **Deterministic Calculation Boundary**: All currency conversions, trial balances, portfolio weights, and backtest metrics are computed by deterministic code—never by LLM token prediction.
9. **Cryptographic Append-Only Audit Trail**: Every assistant run, tool invocation, approval decision, and connector sync appends a SHA-256 hashed entry to the audit log.
10. **Strict Demo / Production Isolation**: When `VITE_DEMO_MODE=true`, all data is synthetic (`DEMO MODE · SIMULATED FINANCIAL DATA`) and zero external network calls are made to financial institutions.
