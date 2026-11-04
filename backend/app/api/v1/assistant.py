"""
O-Finance Assistant API Endpoints (/api/v1/assistant)
Provides assistant runtime status, unified model configuration, and task execution.
"""

from fastapi import APIRouter, status
from app.schemas.assistant import (
    AssistantStatusDto,
    UnifiedModelConfigDto,
    AssistantRunRequestDto,
    AssistantRunResponseDto,
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
