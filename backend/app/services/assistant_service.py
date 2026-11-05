"""
O-Finance Assistant Business Service (Phase 2.2)
Manages assistant configuration, status telemetry, and run requests.
- Confidence Gate: < 0.85 (or specified threshold) creates PENDING approval task
- Audit Logging: Logs "Assistant Execution" via AuditService.append_entry
- Runtime Integration: Uses OFinanceAssistantRuntime for task execution and tool steps
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
        """
        task_id = f"task-{uuid.uuid4().hex[:12]}"
        is_ollama = settings.llm_provider == "Local Ollama"
        execution_origin = "LOCAL_FASTAPI_OLLAMA" if is_ollama else "LOCAL_FASTAPI_GEMINI"

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
