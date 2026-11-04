# O-Finance Security, Credential Isolation & Governance Policy (v0.4.0 · P2.1.2 Security Closure)

## 1. Ten Constitutional Security Invariants

1. **Default-Deny Tool Permission Guard**: Connectors and tools are denied by default. Only tools explicitly on the active Task Mode whitelist can execute.
2. **Read-Only Financial Connectors by Default**: Bank and brokerage integrations (IBKR Flex, Schwab Trader, Plaid, TrueLayer, PSD2 AIS) are strictly restricted to read-only scopes.
3. **Permanent Outbound Fund Block**: Outbound wires, fund withdrawals, live order executions, and credential modifications are permanently blocked at the architecture level (`is_permanently_blocked=True`) and CANNOT be bypassed by any human approval.
4. **Database-Authoritative Approval Verification (P2.1.2)**: `SecurityGuard` never trusts caller-supplied approval status strings or boolean flags. All operations requiring human sign-off must be authoritatively verified by `ApprovalService` against real `ApprovalTaskModel` database records.
5. **Anti-Replay & Anti-Tamper Approval Binding**: Approvals are strictly bound to `task_mode`, `action`, `target`, and `payload_hash`. Once executed, approvals are immediately marked consumed (`is_consumed=True`) and cannot be reused. Expired approvals are rejected.
6. **Single Backend AI Credential (`GEMINI_API_KEY`)**: All cloud LLM tasks share a single API credential stored exclusively in the Python backend environment (`backend/.env`). No secrets exist in React state or `VITE_*` environment variables.
7. **LLM Credential Isolation**: `OFinanceAssistant` never receives banking credentials, OAuth refresh tokens, or API keys in prompt contexts, telemetry, or tool signatures.
8. **Automated Cryptographic Audit Trail (P2.1.2)**: Every assistant run, tool invocation, approval decision, and connector sync is recorded via `AuditService` with sequential SHA-256 hash chaining linking each entry to the preceding record (`prev_hash`).
9. **Deterministic Calculation Boundary**: All FX conversions (`USD`, `GBP`, `EUR`, `CNY`), trial balances, portfolio weights, and backtest metrics are computed by deterministic TypeScript/Python functions—never by LLM token prediction.
10. **Strict Demo / Production Isolation**: When `VITE_DEMO_MODE=true`, all data is synthetic and zero external network calls are made.

---

## 2. Human-In-The-Loop (HITL) Execution Gate Architecture

```text
[Client / LLM Request]
        │
        ▼
[SecurityGuard.check_task_mode_permission]
        │
        ├── 1. Is tool permanently blocked (transfer/order/withdraw)? ──> YES: PERMANENT REJECT (Cannot bypass)
        │
        ├── 2. Is tool in Task Mode whitelist? ──> NO: DEFAULT DENY
        │
        ├── 3. Is tool read-only & confidence >= 0.85? ──> YES: PERMIT EXECUTION
        │
        └── 4. Tool requires approval / confidence < 0.85
                │
                ├── No Approval Provided ──> EXECUTION BLOCKED (PENDING)
                │
                └── approval_task_id Provided
                        │
                        ▼
                [ApprovalService.verify_and_consume_approval(session)]
                        ├── Check DB record exists & status == "Approved"
                        ├── Check is_consumed == False (Replay Prevention)
                        ├── Check expires_at > now (Expiration Check)
                        ├── Check task_mode, action, target, payload_hash match
                        │
                        ├── ANY CHECK FAILS ──> REJECT EXECUTION
                        │
                        └── ALL CHECKS PASS ──> MARK CONSUMED & PERMIT EXECUTION
```

---

## 3. Audit Log Security & Threat Model Disclosure

### 3.1 Immutability Enforcement Layers
1. **ORM-Level Protection**: SQLAlchemy event listeners (`before_update`, `before_delete`) in `app/models/audit.py` intercept and reject any ORM-driven update or delete mutations.
2. **Automated Sequential Hash Chaining**: `AuditService.append_entry()` queries the tail record with row-level locks (`SELECT ... FOR UPDATE`) to prevent concurrency forks and calculates `verification_hash = SHA256(prev_hash | created_at | category | actor | action | target | severity | details)`.
3. **Chain Verification**: `AuditService.verify_database_chain()` scans all records to detect content tampering, broken links, or out-of-order records.

### 3.2 Security Limitations & Database-Level Hardening Requirements
- **ORM Boundary**: SQLAlchemy event listeners ONLY protect against application-level ORM mutations. They **CANNOT** protect against direct raw SQL (`conn.execute("UPDATE audit_logs...")`) executed by database superusers or compromised connections.
- **Production Privilege Hardening (Least Privilege)**:
  ```sql
  -- Recommended PostgreSQL privilege separation:
  REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM ofinance_app_user;
  GRANT SELECT, INSERT ON audit_logs TO ofinance_app_user;
  ```
- **PostgreSQL Database Trigger (Recommended for Production)**:
  ```sql
  CREATE OR REPLACE FUNCTION reject_audit_mutation() RETURNS TRIGGER AS $$
  BEGIN
      RAISE EXCEPTION 'audit_logs table is append-only. UPDATE and DELETE are prohibited.';
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
  ```
- **Cryptographic Scope**: SHA-256 hash chaining provides tamper-evident detection, but is not hardware-grade WORM (Write Once, Read Many) optical storage. Offline database rewrites can be detected via `verify_database_chain()`, but cannot be physically prevented without database privilege separation.
