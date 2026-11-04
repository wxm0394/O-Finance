"""
O-Finance Assistant Business Service
Manages assistant configuration, status telemetry, and run requests.
Phase 2.1: Implements strict contract and explicit un-implemented status.
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
        api_key_configured is determined honestly by checking the backend environment.
        model_verified is False until an actual probe API call succeeds.
        """
        key_configured = settings.is_gemini_key_configured

        return AssistantStatusDto(
            assistant_name="OFinanceAssistant",
            runtime_mode="LOCAL_FASTAPI",
            runtime_status="FastAPI Core Online · Pydantic AI Harness Scaffold",
            provider=settings.llm_provider,
            model=settings.gemini_model if settings.llm_provider == "Gemini" else settings.ollama_model,
            api_key_configured=key_configured,
            api_key_status="Backend Key Configured (Unverified)" if key_configured else "Backend Key Missing",
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
        """
        key_configured = settings.is_gemini_key_configured

        return UnifiedModelConfigDto(
            provider=settings.llm_provider,
            model=settings.gemini_model if settings.llm_provider == "Gemini" else settings.ollama_model,
            base_url=settings.ollama_base_url if settings.llm_provider == "Local Ollama" else "https://generativelanguage.googleapis.com",
            api_key_configured=key_configured,
            api_key_status="Backend Key Configured (Unverified)" if key_configured else "Backend Key Missing",
            model_verified=False,
            daily_budget_usd=settings.assistant_daily_budget_usd,
            max_steps_per_run=settings.assistant_max_steps_per_run,
        )

    @classmethod
    async def run_task(cls, req: AssistantRunRequestDto) -> AssistantRunResponseDto:
        """
        Executes a task under the requested task mode.
        Phase 2.1: Implements the exact HTTP wire contract and returns an explicit
        'scaffold_not_implemented' status. Does NOT fake LLM completions.
        """
        task_id = f"task-{uuid.uuid4().hex[:12]}"

        return AssistantRunResponseDto(
            task_id=task_id,
            task_mode=req.task_mode,
            prompt=req.prompt,
            execution_origin="LOCAL_FASTAPI_GEMINI",
            status="scaffold_not_implemented",
            is_implemented=False,
            message=(
                f"P2.1 Backend Foundation Contract Verified: "
                f"Received '{req.task_mode}' task request for OFinanceAssistant. "
                f"Full Pydantic AI runner harness will be attached in Phase 2.2. "
                f"No synthetic LLM tokens were billed."
            ),
            tool_steps=[],
            tokens_used=None,
            estimated_cost_usd=None,
            requires_human_approval=False,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
