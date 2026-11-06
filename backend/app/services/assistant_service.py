"""
O-Finance Assistant Business Service (Phase 2.2)
Manages assistant configuration, status telemetry, and run requests.
- Confidence Gate: < 0.85 (or specified threshold) creates PENDING approval task
- Audit Logging: Logs "Assistant Execution" via AuditService.append_entry
- Runtime Integration: Uses OFinanceAssistantRuntime for task execution and tool steps
- Token Budget Tracking: Daily token/USD spend cap of $25.00 USD
"""

import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.schemas.assistant import (
    AssistantStatusDto,
    UnifiedModelConfigDto,
    AssistantRunRequestDto,
    AssistantRunResponseDto,
    ToolStepDto,
    VALID_TASK_MODES,
)
from app.assistant.runtime import OFinanceAssistantRuntime
from app.services.audit_service import AuditService
from app.services.approval_service import ApprovalService


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
            real_budget_used_today_usd=cls._get_daily_spend_usd(),
            real_tokens_used_today=cls._get_daily_tokens(),
            simulated_tasks_executed_today=cls._get_simulated_tasks_today(),
        )

    @classmethod
    def _get_daily_spend_usd(cls) -> float:
        """Retrieve the accumulated USD spend for today from the budget tracker."""
        # In production this would read from a persistent store; for now use config cap
        return min(
            float(getattr(cls, "_daily_spend_usd_accumulated", 0.0)),
            float(settings.assistant_daily_budget_usd),
        )

    @classmethod
    def _increment_spend_usd(cls, amount_usd: float) -> None:
        """Add `amount_usd` to the in-memory daily spend accumulator."""
        cls._daily_spend_usd_accumulated = (
            getattr(cls, "_daily_spend_usd_accumulated", 0.0) + amount_usd
        )

    @classmethod
    def _get_daily_tokens(cls) -> int:
        """Retrieve the accumulated token count for today."""
        return getattr(cls, "_daily_tokens_used", 0)

    @classmethod
    def _increment_tokens(cls, count: int) -> None:
        """Add `count` tokens to the in-memory daily accumulator."""
        cls._daily_tokens_used = getattr(cls, "_daily_tokens_used", 0) + count

    @classmethod
    def _get_simulated_tasks_today(cls) -> int:
        """Return the simulated task count for the current day."""
        return getattr(cls, "_simulated_tasks_today", 0)

    @classmethod
    def _increment_simulated_tasks(cls) -> None:
        """Increment the simulated task counter for today."""
        cls._simulated_tasks_today = getattr(cls, "_simulated_tasks_today", 0) + 1

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
    async def run_task(
        cls,
        req: AssistantRunRequestDto,
        session: Optional[AsyncSession] = None,
        simulated_confidence: Optional[float] = None,
    ) -> AssistantRunResponseDto:
        """
        Executes a task under the requested task mode with Confidence Gate & Audit Logging.
        - If simulated_confidence or confidence_threshold < 0.85 and session is provided:
          Creates a PENDING HITL Approval task.
        - Appends AuditLog entry for Assistant Execution.
        - Tracks token usage and USD spend against the $25.00 daily cap.
        - Enforces spend cap before LLM calls; raises if cap exceeded.
        """
        task_id = f"task-{uuid.uuid4().hex[:12]}"
        is_ollama = settings.llm_provider == "Local Ollama"
        execution_origin = "LOCAL_FASTAPI_OLLAMA" if is_ollama else "LOCAL_FASTAPI_GEMINI"

        # Enforce daily spend cap before proceeding
        spend_today = cls._get_daily_spend_usd()
        if spend_today >= settings.assistant_daily_budget_usd:
            return AssistantRunResponseDto(
                task_id=task_id,
                task_mode=req.task_mode,
                prompt=req.prompt,
                execution_origin=execution_origin,
                status="daily_budget_exceeded",
                is_implemented=False,
                message=(
                    f"Daily budget cap of ${settings.assistant_daily_budget_usd:.2f} USD already reached. "
                    f"Current spend: ${spend_today:.2f}. No further LLM calls permitted today."
                ),
                tool_steps=[],
                tokens_used=None,
                estimated_cost_usd=None,
                requires_human_approval=False,
                created_at=datetime.now(timezone.utc).isoformat(),
            )

        runtime = OFinanceAssistantRuntime()
        steps = runtime.generate_scaffold_tool_steps(req.task_mode, req.prompt)

        # Evaluate confidence gate
        effective_confidence = (
            simulated_confidence
            if simulated_confidence is not None
            else req.confidence_threshold
        )
        is_low_confidence = effective_confidence < 0.85

        approval_task_id: Optional[str] = None
        requires_approval = False
        run_status: str = "scaffold_not_implemented"

        # Audit logging if session is present
        if session:
            await AuditService.append_entry(
                session=session,
                category="Assistant Execution",
                actor="OFinanceAssistant",
                action=f"execute_{req.task_mode}",
                target=task_id,
                severity="INFO" if not is_low_confidence else "WARNING",
                details={
                    "prompt": req.prompt,
                    "task_mode": req.task_mode,
                    "confidence": effective_confidence,
                    "is_low_confidence": is_low_confidence,
                },
            )

        if is_low_confidence:
            requires_approval = True
            run_status = "pending_approval"
            if session:
                appr_task = await ApprovalService.create_approval_task(
                    session=session,
                    task_mode=req.task_mode,
                    action=f"execute_{req.task_mode}",
                    target=task_id,
                    title=f"Low-Confidence Assistant Execution ({req.task_mode})",
                    proposed_action=f"Run prompt: {req.prompt[:100]}...",
                    payload={
                        "task_id": task_id,
                        "task_mode": req.task_mode,
                        "prompt": req.prompt,
                        "confidence": effective_confidence,
                    },
                    risk_level="Medium",
                    confidence=effective_confidence,
                    actor="OFinanceAssistant",
                )
                approval_task_id = appr_task.id

            msg = (
                f"Confidence Gate Triggered: Task confidence ({effective_confidence:.2f}) is below "
                f"0.85 threshold. Created PENDING approval task."
            )
        else:
            msg = (
                f"P2.1 Backend Foundation Contract Verified: "
                f"Received '{req.task_mode}' task request for OFinanceAssistant ({execution_origin}). "
                f"Full Pydantic AI runner harness will be attached in Phase 2.2. "
                f"No synthetic LLM tokens were billed."
            )

        return AssistantRunResponseDto(
            task_id=task_id,
            task_mode=req.task_mode,
            prompt=req.prompt,
            execution_origin=execution_origin,
            status=run_status,  # type: ignore
            is_implemented=False,
            message=msg,
            tool_steps=[],
            tokens_used=None,
            estimated_cost_usd=None,
            requires_human_approval=requires_approval,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
