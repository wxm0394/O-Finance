"""
O-Finance Assistant Runtime Harness (Phase 2.2 Pydantic AI Integration)
Manages Task Mode Profiles, Tool Invocation Guarding, and Dual-Mode Execution.
Authoritative tool authorization & execution dispatcher.
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import OperationPermission, SecurityGuard
from app.schemas.assistant import AssistantTaskMode, ToolStepDto, VALID_TASK_MODES


@dataclass
class ModeProfile:
    task_mode: AssistantTaskMode
    system_prompt: str
    allowed_tools: Set[str]
    risk_level: str  # "LOW", "MEDIUM", "HIGH"
    description: str


MODE_PROFILES: Dict[AssistantTaskMode, ModeProfile] = {
    "accounting": ModeProfile(
        task_mode="accounting",
        system_prompt=(
            "You are OFinanceAssistant in Accounting Mode. "
            "Classify settled transactions into Beancount accounts and draft double-entry journals."
        ),
        allowed_tools=SecurityGuard.TASK_MODE_TOOL_WHITELIST.get("accounting", set()),
        risk_level="HIGH",
        description="Double-entry journal entries, transaction parsing, and ledger reading.",
    ),
    "portfolio_analysis": ModeProfile(
        task_mode="portfolio_analysis",
        system_prompt=(
            "You are OFinanceAssistant in Portfolio Analysis Mode. "
            "Analyze asset allocation, sector weights, and currency risk."
        ),
        allowed_tools=SecurityGuard.TASK_MODE_TOOL_WHITELIST.get("portfolio_analysis", set()),
        risk_level="LOW",
        description="Asset allocation, holding weights, and returns analysis.",
    ),
    "research": ModeProfile(
        task_mode="research",
        system_prompt=(
            "You are OFinanceAssistant in Research Mode. "
            "Synthesize macro briefings, earnings notes, and fundamental developments."
        ),
        allowed_tools=SecurityGuard.TASK_MODE_TOOL_WHITELIST.get("research", set()),
        risk_level="LOW",
        description="Market news, earnings notes, and fundamental synthesis.",
    ),
    "quantitative_research": ModeProfile(
        task_mode="quantitative_research",
        system_prompt=(
            "You are OFinanceAssistant in Quantitative Research Mode. "
            "Analyze DuckDB backtests, risk attribution, and transaction friction."
        ),
        allowed_tools=SecurityGuard.TASK_MODE_TOOL_WHITELIST.get("quantitative_research", set()),
        risk_level="MEDIUM",
        description="DuckDB analytical queries, backtesting, and factor modeling.",
    ),
    "audit": ModeProfile(
        task_mode="audit",
        system_prompt=(
            "You are OFinanceAssistant in Audit Mode. "
            "Verify trial balance conservation, detect duplicate fees, and flag discrepancies."
        ),
        allowed_tools=SecurityGuard.TASK_MODE_TOOL_WHITELIST.get("audit", set()),
        risk_level="LOW",
        description="Trial balance verification and audit log discrepancy inspection.",
    ),
    "risk_analysis": ModeProfile(
        task_mode="risk_analysis",
        system_prompt=(
            "You are OFinanceAssistant in Risk Analysis Mode. "
            "Evaluate portfolio concentration limits and stress scenarios."
        ),
        allowed_tools=SecurityGuard.TASK_MODE_TOOL_WHITELIST.get("risk_analysis", set()),
        risk_level="MEDIUM",
        description="Value-at-Risk calculations and scenario stress testing.",
    ),
}


class ToolInvocationResult(BaseModel):
    tool_name: str
    success: bool
    requires_approval: bool = False
    message: str
    output: Optional[Dict[str, Any]] = None


class OFinanceAssistantRuntime:
    """
    Central Pydantic AI Harness Runtime.
    Manages 6 Task Mode Profiles, validates tool calls via SecurityGuard,
    and dispatches execution across real LLM or deterministic scaffold.
    """

    SUPPORTED_MODES = VALID_TASK_MODES

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or settings.gemini_model

    @classmethod
    def get_mode_profile(cls, task_mode: AssistantTaskMode) -> ModeProfile:
        """Retrieves authoritative ModeProfile for a task mode."""
        if task_mode not in MODE_PROFILES:
            raise ValueError(f"Unsupported task_mode '{task_mode}'")
        return MODE_PROFILES[task_mode]

    def validate_task_permissions(
        self, task_mode: AssistantTaskMode, tool_name: str
    ) -> OperationPermission:
        """Enforces SecurityGuard permission check before tool execution."""
        return SecurityGuard.check_task_mode_permission(task_mode, tool_name)

    def invoke_tool(
        self,
        task_mode: AssistantTaskMode,
        tool_name: str,
        payload: Optional[Dict[str, Any]] = None,
        approval_task_id: Optional[str] = None,
    ) -> ToolInvocationResult:
        """
        Guarded tool invocation dispatcher.
        Checks mode isolation, HITL requirements, and permanently blocked actions.
        """
        perm = self.validate_task_permissions(task_mode, tool_name)

        if not perm.is_permitted:
            return ToolInvocationResult(
                tool_name=tool_name,
                success=False,
                requires_approval=perm.requires_approval,
                message=f"PERMISSION_DENIED: {perm.reason}",
            )

        if perm.requires_approval and not approval_task_id:
            return ToolInvocationResult(
                tool_name=tool_name,
                success=False,
                requires_approval=True,
                message=f"HUMAN_APPROVAL_REQUIRED: Operation '{tool_name}' requires explicit approval token.",
            )

        # Deterministic execution for allowed tool
        return ToolInvocationResult(
            tool_name=tool_name,
            success=True,
            requires_approval=False,
            message=f"Tool '{tool_name}' executed successfully under mode '{task_mode}'.",
            output={"status": "success", "payload": payload or {}},
        )

    def generate_scaffold_tool_steps(
        self, task_mode: AssistantTaskMode, prompt: str
    ) -> List[ToolStepDto]:
        """Generates deterministic tool steps for scaffold / testing execution."""
        profile = self.get_mode_profile(task_mode)
        tools = sorted(list(profile.allowed_tools))
        steps: List[ToolStepDto] = []

        for idx, tool in enumerate(tools[:3], start=1):
            perm = SecurityGuard.check_task_mode_permission(task_mode, tool)
            steps.append(
                ToolStepDto(
                    step_number=idx,
                    tool_name=tool,
                    category=task_mode,
                    call_signature=f"{tool}(prompt={prompt[:20]!r})",
                    status="completed" if perm.is_permitted else "blocked",
                    duration_ms=12 + idx * 5,
                    finding=f"Executed {tool} under {task_mode} mode profile.",
                )
            )

        return steps


# Alias for backward compatibility
AssistantRuntimeScaffold = OFinanceAssistantRuntime
