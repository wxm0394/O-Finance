# O-Finance Security & Governance Specification

## 1. Ten Core Security Principles

1. **Read-Only Financial Connectors by Default**: Interactive Brokers Flex Web Service, Charles Schwab Trader API, Plaid Investments, and GoCardless Open Banking AIS are configured strictly with read-only scopes.
2. **Server-Side / Local Vault Credential Storage**: Banking credentials, OAuth refresh tokens, and API secrets are stored exclusively in the local OS keyring or encrypted backend vault—never in browser `localStorage` or `VITE_` frontend variables.
3. **Zero Frontend Secret Exposure**: The React UI only receives normalized financial records and non-sensitive configuration metadata.
4. **LLM Credential Isolation**: Pydantic AI agents never receive raw financial credentials or session tokens in their system prompts or context windows.
5. **Non-Bypassable Tool Permission Guard**: Every tool invocation by an Agent is intercepted by the deterministic permission matrix (`Read-Only`, `Computation`, `Drafting`, `Governance`).
6. **Immutable Raw Financial Data**: Raw bank and brokerage payloads imported during synchronization are stored in an append-only table and can never be overwritten or deleted by AI agents.
7. **Audited Double-Entry Ledger Changes**: Every Beancount journal modification records a SHA-256 verification hash, timestamp, and actor in the Audit Log.
8. **Human-in-the-Loop Approval Gate**: Any transaction classification with confidence `< 0.85` or high-severity concentration warning is routed to the Approval Inbox for human sign-off.
9. **Prohibited Execution Capabilities**: Automated bank wires, withdrawals, live brokerage order placement, and raw ledger deletion are permanently disabled at the architecture level.
10. **Strict Demo vs Production Isolation**: When `VITE_DEMO_MODE=true`, the application operates 100% on synthetic in-memory data with prominent `DEMO MODE · SIMULATED FINANCIAL DATA` banners on every screen.
