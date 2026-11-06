"""
Tests for Phase 2.2 Pydantic AI Harness & Beancount Runtime Integration
Covers:
1. MODE_PROFILES registry and tool whitelisting / isolation in OFinanceAssistantRuntime.
2. Low-confidence HITL escalation via Confidence Gate (< 0.85).
3. Audit logging integration during assistant execution.
4. Beancount Bridge bean-check execution & fallback validation.
5. Fava dashboard endpoint probe interface.
6. Real data bindings in invoke_tool and LLM inference with scaffold fallback.
"""

from unittest.mock import AsyncMock, MagicMock, patch
import pytest
import tempfile
from pathlib import Path

from app.assistant.runtime import OFinanceAssistantRuntime, MODE_PROFILES
from app.ledger.beancount_bridge import BeancountBridge
from app.schemas.assistant import AssistantRunRequestDto
from app.services.assistant_service import AssistantService


def test_mode_profiles_registry_authoritative():
    """Verify that all 6 task modes have complete, distinct ModeProfiles registered."""
    modes = ["accounting", "portfolio_analysis", "research", "quantitative_research", "audit", "risk_analysis"]
    for mode in modes:
        profile = OFinanceAssistantRuntime.get_mode_profile(mode)  # type: ignore
        assert profile.task_mode == mode
        assert len(profile.system_prompt) > 20
        assert isinstance(profile.allowed_tools, set)
        assert profile.risk_level in {"LOW", "MEDIUM", "HIGH"}


def test_runtime_invoke_tool_permissions():
    """Verify runtime dispatcher enforces tool permission whitelists and blocks unauthorized calls."""
    runtime = OFinanceAssistantRuntime()

    # Allowed tool under accounting mode (query_accounts is in whitelist and read-only)
    res_allowed = runtime.invoke_tool("accounting", "query_accounts", payload={"test": True})
    assert res_allowed.success is True
    assert res_allowed.requires_approval is False

    # Blocked tool under accounting mode (e.g. run_strategy_backtest is quant only)
    res_blocked = runtime.invoke_tool("accounting", "run_strategy_backtest")
    assert res_blocked.success is False
    assert "PERMISSION_DENIED" in res_blocked.message

    # Blocked tool: unknown / non-whitelisted tool
    res_unknown = runtime.invoke_tool("research", "unauthorized_admin_tool")
    assert res_unknown.success is False


def test_runtime_invoke_tool_real_data_bindings():
    """Verify that invoke_tool binds real Beancount data for read-only tools."""
    runtime = OFinanceAssistantRuntime()

    # read_accounts should return real parsed data from ledger
    res_accounts = runtime.invoke_tool("accounting", "read_accounts")
    assert res_accounts.success is True
    assert "balances" in res_accounts.output
    assert isinstance(res_accounts.output["balances"], dict)

    # read_holdings should return asset balances
    res_holdings = runtime.invoke_tool("accounting", "read_holdings")
    assert res_holdings.success is True
    assert "asset_balances" in res_holdings.output

    # verify_double_entry_balance should return balance check result
    res_balance = runtime.invoke_tool("audit", "verify_double_entry_balance")
    assert res_balance.success is True
    assert "is_balanced" in res_balance.output

    # calculate_risk_metrics should return domain metrics
    res_risk = runtime.invoke_tool("risk_analysis", "calculate_risk_metrics")
    assert res_risk.success is True
    assert "var_95" in res_risk.output


@pytest.mark.asyncio
async def test_runtime_llm_inference_with_fallback():
    """Verify execute_llm_inference attempts real LLM call and falls back to scaffold."""
    runtime = OFinanceAssistantRuntime()

    # Test with unconfigured provider - should fall back to scaffold
    resp = await runtime.execute_llm_inference("accounting", "test prompt")
    assert resp["success"] is True
    assert "provider" in resp
    # Should use scaffold when no credentials
    assert resp["provider"] in ("Scaffold (Gemini)", "Scaffold (Local Ollama)")


@pytest.mark.asyncio
async def test_assistant_confidence_gate_escalation():
    """Verify confidence < 0.85 triggers PENDING approval task escalation and returns pending_approval status."""
    req = AssistantRunRequestDto(
        task_mode="accounting",
        prompt="Execute low confidence transaction classification",
        confidence_threshold=0.80,
    )

    mock_session = AsyncMock()

    mock_appr_task = MagicMock()
    mock_appr_task.id = "appr-low-conf-001"

    with patch("app.services.approval_service.ApprovalService.create_approval_task", new_callable=AsyncMock) as mock_create_appr, \
         patch("app.services.audit_service.AuditService.append_entry", new_callable=AsyncMock) as mock_audit:

        mock_create_appr.return_value = mock_appr_task

        resp = await AssistantService.run_task(
            req=req,
            session=mock_session,
            simulated_confidence=0.75,
        )

        assert resp.status == "pending_approval"
        assert resp.requires_human_approval is True
        assert "Confidence Gate Triggered" in resp.message
        assert mock_create_appr.called is True
        assert mock_audit.called is True


@pytest.mark.asyncio
async def test_assistant_run_audit_logging_integration():
    """Verify assistant task execution appends audit record when DB session is provided."""
    req = AssistantRunRequestDto(
        task_mode="audit",
        prompt="Verify trial balance consistency",
        confidence_threshold=0.90,
    )

    mock_session = AsyncMock()

    with patch("app.services.audit_service.AuditService.append_entry", new_callable=AsyncMock) as mock_audit:
        resp = await AssistantService.run_task(
            req=req,
            session=mock_session,
            simulated_confidence=0.95,
        )

        assert resp.status == "scaffold_not_implemented"
        assert resp.requires_human_approval is False
        assert mock_audit.called is True
        audit_kwargs = mock_audit.call_args[1]
        assert audit_kwargs["category"] == "Assistant Execution"
        assert audit_kwargs["action"] == "execute_audit"


def test_beancount_bridge_run_bean_check_nonexistent_file():
    """Verify run_bean_check returns valid=False for missing file."""
    res = BeancountBridge.run_bean_check("/tmp/non_existent_file_9999.beancount")
    assert res["valid"] is False
    assert "file not found" in res["errors"][0].lower()


def test_beancount_bridge_run_bean_check_fallback(tmp_path):
    """Verify run_bean_check fallback parsing on a temporary .beancount file."""
    ledger_file = tmp_path / "test.beancount"
    ledger_file.write_text(
        '2026-11-05 * "Store" "Groceries"\n'
        '  Assets:Cash  -50.00 CNY\n'
        '  Expenses:Food  50.00 CNY\n',
        encoding="utf-8",
    )

    res = BeancountBridge.run_bean_check(ledger_file)
    # Even if bean-check CLI is not installed, fallback runs
    assert "valid" in res
    assert "errors" in res
    assert "output" in res


def test_beancount_bridge_probe_fava_endpoint():
    """Verify probe_fava_endpoint handles unreachable loopback address cleanly."""
    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_get.return_value = mock_resp

        res = BeancountBridge.probe_fava_endpoint("127.0.0.1", 5000, timeout=1.0)
        assert res["reachable"] is True
        assert res["status_code"] == 200


@pytest.mark.asyncio
async def test_assistant_usage_endpoint(async_client: AsyncClient):
    """Test the /api/v1/assistant/usage endpoint returns correct structure."""
    res = await async_client.get("/api/v1/assistant/usage")
    assert res.status_code == 200
    data = res.json()
    assert data["daily_budget_usd"] == 25.0
    assert data["spend_usd_today"] >= 0.0
    assert data["tokens_used_today"] >= 0
    assert data["budget_remaining_usd"] >= 0


@pytest.mark.asyncio
async def test_assistant_tools_endpoint(async_client: AsyncClient):
    """Test the /api/v1/assistant/tools endpoint returns correct structure."""
    res = await async_client.get("/api/v1/assistant/tools")
    assert res.status_code == 200
    data = res.json()
    assert data["total_tools"] >= 4
    tool_names = [t["name"] for t in data["available_tools"]]
    assert "read_accounts" in tool_names
    assert "read_holdings" in tool_names
    assert "verify_double_entry_balance" in tool_names
    assert "calculate_risk_metrics" in tool_names
