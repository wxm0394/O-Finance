"""
O-Finance Assistant Schemas (Pydantic v2 DTOs)
Strictly snake_case wire format matching the O-Finance Frontend API contract.
"""

from typing import Dict, List, Literal, Optional, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field, field_validator

# 6 Supported Task Modes on the single OFinanceAssistant
AssistantTaskMode = Literal[
    "accounting",
    "portfolio_analysis",
    "research",
    "quantitative_research",
    "audit",
    "risk_analysis",
]

VALID_TASK_MODES: List[str] = [
    "accounting",
    "portfolio_analysis",
    "research",
    "quantitative_research",
    "audit",
    "risk_analysis",
]


class ToolStepDto(BaseModel):
    step_number: int
    tool_name: str
    category: str
    call_signature: str
    status: str
    duration_ms: int
    finding: str


class AssistantStatusDto(BaseModel):
    assistant_name: str = "OFinanceAssistant"
    runtime_mode: str = "LOCAL_FASTAPI"
    runtime_status: str
    provider: str
    model: str
    api_key_configured: bool
    api_key_status: str
    model_verified: bool
    supported_modes: List[AssistantTaskMode] = Field(default_factory=lambda: list(VALID_TASK_MODES))  # type: ignore
    active_task_mode: AssistantTaskMode = "accounting"
    daily_budget_usd: float = 25.0
    real_budget_used_today_usd: float = 0.0
    real_tokens_used_today: int = 0
    simulated_tasks_executed_today: int = 0


class UnifiedModelConfigDto(BaseModel):
    provider: str
    model: str
    base_url: str
    api_key_configured: bool
    api_key_status: str
    model_verified: bool
    daily_budget_usd: float
    max_steps_per_run: int
    llm_provider: Optional[str] = None
    llm_base_url: Optional[str] = None
    llm_model: Optional[str] = None
    api_key_masked: Optional[str] = None
    # CRITICAL: Under no circumstances should raw GEMINI_API_KEY / LLM_API_KEY be present here.


class UpdateAssistantConfigRequest(BaseModel):
    provider: str = Field(default="openai_compatible")
    base_url: str = Field(default="https://api.openai.com/v1")
    model_name: str = Field(default="gpt-4o")
    api_key: Optional[str] = None


class AssistantProbeResponseDto(BaseModel):
    reachable: bool
    latency_ms: float
    provider: str
    base_url: str
    model: str
    message: str


class AssistantRunRequestDto(BaseModel):
    task_mode: AssistantTaskMode
    prompt: str = Field(min_length=1, max_length=4000)
    base_currency: Literal["USD", "GBP", "EUR", "CNY"] = "USD"
    time_horizon: Optional[str] = None
    confidence_threshold: float = Field(default=0.85, ge=0.0, le=1.0)
    max_tool_steps: int = Field(default=8, ge=1, le=20)
    approval_task_id: Optional[str] = None

    @field_validator("task_mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        if v not in VALID_TASK_MODES:
            raise ValueError(
                f"Invalid task_mode '{v}'. Allowed modes: {', '.join(VALID_TASK_MODES)}"
            )
        return v


class AssistantRunResponseDto(BaseModel):
    task_id: str
    task_mode: AssistantTaskMode
    prompt: str
    execution_origin: str = "LOCAL_FASTAPI_GEMINI"
    status: str
    message: str
    is_implemented: bool
    tool_steps: List[ToolStepDto] = Field(default_factory=list)
    tokens_used: Optional[int] = None
    estimated_cost_usd: Optional[float] = None
    requires_human_approval: bool = False
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class AssistantUsageDto(BaseModel):
    daily_budget_usd: float = 25.0
    spend_usd_today: float = 0.0
    tokens_used_today: int = 0
    budget_remaining_usd: float = 25.0


class AssistantToolsDto(BaseModel):
    available_tools: List[Dict[str, Any]] = Field(default_factory=list)
    total_tools: int = 0
