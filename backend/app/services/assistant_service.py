"""
O-Finance Assistant Business Service
Manages assistant configuration, status telemetry, and run requests.
Phase 2.1: Implements strict contract and explicit un-implemented status.
Accurately reflects provider differences (Gemini Cloud vs. Local Ollama).
Does NOT fabricate LLM execution traces.
"""

import uuid
from datetime import datetime, timezone
from app.core.config import settings
from app.schemas.assistant import (
    AssistantStatusDto,
    UnifiedModelConfigDto,
    AssistantRunRequestDto,
    AssistantRunResponseDto,
    VALID_TASK_MODES,
)


class AssistantService:
    """Service layer managing the single OFinanceAssistant instance."""

    @classmethod
    def get_status(cls) -> AssistantStatusDto:
        """
        Returns runtime status of the single OFinanceAssistant.
        Distinguishes Gemini Cloud API key requirements from Local Ollama mode.
        model_verified is False until an actual probe API call succeeds.
        """
        is_ollama = settings.llm_provider == "Local Ollama"

        if is_ollama:
            key_configured = True
            key_status = "Local Ollama Active (No API Key Required)"
            active_model = settings.ollama_model
        else:
            key_configured = settings.is_gemini_key_configured
            key_status = (
                "Backend Key Configured (Unverified)"
                if key_configured
                else "Backend Key Missing"
            )
            active_model = settings.gemini_model

        return AssistantStatusDto(
            assistant_name="OFinanceAssistant",
            runtime_mode="LOCAL_FASTAPI",
            runtime_status="FastAPI Core Online · Pydantic AI Harness Scaffold",
            provider=settings.llm_provider,
            model=active_model,
            api_key_configured=key_configured,
            api_key_status=key_status,
            model_verified=False,  # Cannot claim verified without live probe call
            active_task_mode="accounting",
            daily_budget_usd=settings.assistant_daily_budget_usd,
            real_budget_used_today_usd=0.0,
            real_tokens_used_today=0,
            simulated_tasks_executed_today=0,
        )

    @classmethod
    def get_unified_config(cls) -> UnifiedModelConfigDto:
        """
        Returns model configuration metadata.
        Strictly excludes GEMINI_API_KEY from the payload.
        Accurately reports base_url and credentials depending on provider.
        """
        is_ollama = settings.llm_provider == "Local Ollama"

        if is_ollama:
            key_configured = True
            key_status = "Local Ollama Active (No API Key Required)"
            active_model = settings.ollama_model
            base_url = settings.ollama_base_url
        else:
            key_configured = settings.is_gemini_key_configured
            key_status = (
                "Backend Key Configured (Unverified)"
                if key_configured
                else "Backend Key Missing"
            )
            active_model = settings.gemini_model
            base_url = "https://generativelanguage.googleapis.com"

        return UnifiedModelConfigDto(
            provider=settings.llm_provider,
            model=active_model,
            base_url=base_url,
            api_key_configured=key_configured,
            api_key_status=key_status,
            model_verified=False,
            daily_budget_usd=settings.assistant_daily_budget_usd,
            max_steps_per_run=settings.assistant_max_steps_per_run,
        )

    @classmethod
    async def run_task(cls, req: AssistantRunRequestDto) -> AssistantRunResponseDto:
        """
        Executes a task under the requested task mode.
        Phase 2.1: Implements the exact HTTP wire contract and returns an explicit
        'scaffold_not_implemented' status.
        Execution origin correctly reflects Local Ollama vs. Gemini.
        """
        task_id = f"task-{uuid.uuid4().hex[:12]}"
        is_ollama = settings.llm_provider == "Local Ollama"
        execution_origin = "LOCAL_FASTAPI_OLLAMA" if is_ollama else "LOCAL_FASTAPI_GEMINI"

        return AssistantRunResponseDto(
            task_id=task_id,
            task_mode=req.task_mode,
            prompt=req.prompt,
            execution_origin=execution_origin,
            status="scaffold_not_implemented",
            is_implemented=False,
            message=(
                f"P2.1 Backend Foundation Contract Verified: "
                f"Received '{req.task_mode}' task request for OFinanceAssistant ({execution_origin}). "
                f"Full Pydantic AI runner harness will be attached in Phase 2.2. "
                f"No synthetic LLM tokens were billed."
            ),
            tool_steps=[],
            tokens_used=None,
            estimated_cost_usd=None,
            requires_human_approval=False,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
