"""
O-Finance Assistant Runtime Scaffold (Pydantic AI Integration Point)
Architecture Blueprint for Phase 2.2:
- Single reusable Agent: OFinanceAssistant
- Six Task Modes as dynamic configuration profiles (not multiple agents)
- Shared Gemini provider & API key
- Typed tools with permission guard validation
"""

from typing import Any, Dict, List, Optional
from app.schemas.assistant import AssistantTaskMode, VALID_TASK_MODES
from app.core.security import SecurityGuard


class AssistantRuntimeScaffold:
    """
    Scaffold representing the central Pydantic AI harness.
    In Phase 2.2, this will wrap `pydantic_ai.Agent[FinanceDependencies, StructuredOutput]`.
    """

    SUPPORTED_MODES = VALID_TASK_MODES

    def __init__(self, model_name: str = "gemini-2.5-pro"):
        self.model_name = model_name

    def validate_task_permissions(
        self, task_mode: AssistantTaskMode, tool_name: str
    ) -> bool:
        """Enforces security guard invariant before any tool execution."""
        perm = SecurityGuard.check_task_mode_permission(task_mode, tool_name)
        return perm.is_permitted

    def get_mode_prompt_template(self, task_mode: AssistantTaskMode) -> str:
        """Returns dynamic system instructions for each task mode."""
        prompts = {
            "accounting": (
                "You are OFinanceAssistant in Accounting Mode. "
                "Classify settled transactions into Beancount accounts and draft double-entry journals."
            ),
            "portfolio_analysis": (
                "You are OFinanceAssistant in Portfolio Analysis Mode. "
                "Analyze asset allocation, sector weights, and currency risk."
            ),
            "research": (
                "You are OFinanceAssistant in Research Mode. "
                "Synthesize macro briefings, earnings notes, and fundamental developments."
            ),
            "quantitative_research": (
                "You are OFinanceAssistant in Quantitative Research Mode. "
                "Analyze DuckDB backtests, risk attribution, and transaction friction."
            ),
            "audit": (
                "You are OFinanceAssistant in Audit Mode. "
                "Verify trial balance conservation, detect duplicate fees, and flag discrepancies."
            ),
            "risk_analysis": (
                "You are OFinanceAssistant in Risk Analysis Mode. "
                "Evaluate portfolio concentration limits and stress scenarios."
            ),
        }
        return prompts.get(task_mode, "You are OFinanceAssistant.")
