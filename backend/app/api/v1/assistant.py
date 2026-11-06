"""
O-Finance Assistant API Endpoints (/api/v1/assistant)
Provides assistant runtime status, unified model configuration, task execution,
daily token/USD spend usage, and available tool metadata.
"""

from fastapi import APIRouter, status
from app.core.config import settings
from app.schemas.assistant import (
    AssistantStatusDto,
    UnifiedModelConfigDto,
    UpdateAssistantConfigRequest,
    AssistantProbeResponseDto,
    AssistantRunRequestDto,
    AssistantRunResponseDto,
    AssistantUsageDto,
    AssistantToolsDto,
)
from app.services.assistant_service import AssistantService

router = APIRouter(prefix="/assistant", tags=["Assistant"])


@router.get(
    "/status",
    response_model=AssistantStatusDto,
    summary="Get OFinanceAssistant Runtime Status",
    description="Returns runtime mode, active provider, model name, and honest backend API key status.",
)
async def get_assistant_status() -> AssistantStatusDto:
    return AssistantService.get_status()


@router.get(
    "/config",
    response_model=UnifiedModelConfigDto,
    summary="Get Unified Model Configuration",
    description="Returns model configuration without leaking API secrets.",
)
async def get_assistant_config() -> UnifiedModelConfigDto:
    return AssistantService.get_unified_config()


@router.post(
    "/run",
    response_model=AssistantRunResponseDto,
    status_code=status.HTTP_200_OK,
    summary="Execute OFinanceAssistant Task",
    description="Submits a task under one of 6 task modes. Returns explicit contract state without mock completions.",
)
async def run_assistant_task(payload: AssistantRunRequestDto) -> AssistantRunResponseDto:
    return await AssistantService.run_task(payload)


@router.get(
    "/usage",
    response_model=AssistantUsageDto,
    summary="Get Daily Assistant Token/USD Usage",
    description="Returns accumulated token count and USD spend for the current day against the $25.00 cap.",
)
async def get_assistant_usage() -> AssistantUsageDto:
    spend_usd = AssistantService._get_daily_spend_usd()
    tokens_used = AssistantService._get_daily_tokens()
    daily_budget = float(settings.assistant_daily_budget_usd)
    return AssistantUsageDto(
        daily_budget_usd=daily_budget,
        spend_usd_today=spend_usd,
        tokens_used_today=tokens_used,
        budget_remaining_usd=max(0.0, daily_budget - spend_usd),
    )


@router.get(
    "/tools",
    response_model=AssistantToolsDto,
    summary="Get Available Assistant Tools",
    description="Returns metadata about the read-only tools available to the assistant runtime (read_accounts, read_holdings, verify_double_entry_balance, calculate_risk_metrics).",
)
async def get_assistant_tools() -> AssistantToolsDto:
    return AssistantToolsDto(
        available_tools=[
            {
                "name": "read_accounts",
                "description": "Read account balances from the Beancount ledger file.",
                "source": "beancount_file",
            },
            {
                "name": "read_holdings",
                "description": "Read asset holdings from the Beancount ledger file.",
                "source": "beancount_file",
            },
            {
                "name": "verify_double_entry_balance",
                "description": "Verify double-entry balance conservation across all accounts.",
                "source": "beancount_file",
            },
            {
                "name": "calculate_risk_metrics",
                "description": "Calculate portfolio risk metrics (VaR, Sharpe, max drawdown, beta).",
                "source": "domain_quant_engine",
            },
        ],
        total_tools=4,
    )


@router.post(
    "/config",
    response_model=UnifiedModelConfigDto,
    status_code=status.HTTP_200_OK,
    summary="Update Unified Model Configuration",
    description="Updates LLM provider, base URL, model name, and API key at runtime. Returns updated config without leaking raw secrets.",
)
async def update_assistant_config(
    req: UpdateAssistantConfigRequest,
) -> UnifiedModelConfigDto:
    return await AssistantService.update_config(req)


@router.post(
    "/probe",
    response_model=AssistantProbeResponseDto,
    status_code=status.HTTP_200_OK,
    summary="Probe LLM Endpoint Connectivity",
    description="Tests reachability and measures latency against a configured or provided LLM endpoint.",
)
async def probe_assistant_connection(
    req: UpdateAssistantConfigRequest,
) -> AssistantProbeResponseDto:
    return await AssistantService.probe_connection(req)
