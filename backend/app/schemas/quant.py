"""
O-Finance Quantitative Backtest Schemas
Strict snake_case DTOs matching /api/v1/quant/* wire contract.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class QuantStrategyDto(BaseModel):
    """Metadata for a supported quantitative trading strategy."""
    id: str = Field(..., description="Unique strategy identifier.")
    name: str = Field(..., description="Human-readable strategy name.")
    category: str = Field(..., description="Strategy category/classification.")
    description: str = Field(..., description="Detailed strategy description.")
    default_parameters: Dict[str, Any] = Field(
        ..., description="Default parameter values for the strategy."
    )


class BacktestRequestDto(BaseModel):
    """Request payload for parameterized backtest execution."""
    strategy_id: str = Field(..., description="Quantitative strategy identifier.")
    symbols: List[str] = Field(
        ..., description="List of ticker symbols to backtest across."
    )
    start_date: str = Field(
        ..., description="Backtest start date (YYYY-MM-DD)."
    )
    end_date: str = Field(
        ..., description="Backtest end date (YYYY-MM-DD)."
    )
    initial_capital: float = Field(
        100000.0,
        description="Starting capital in base currency units.",
        ge=100.0,
    )
    commission_bps: float = Field(
        5.0,
        description="Bilateral commission cost in basis points (1 bps = 0.01%).",
        ge=0.0,
        le=1000.0,
    )
    slippage_bps: float = Field(
        2.0,
        description="Bilateral slippage cost in basis points.",
        ge=0.0,
        le=1000.0,
    )
    parameters: Optional[Dict[str, Any]] = Field(
        None,
        description="Optional strategy-specific parameter overrides.",
    )


class BacktestResultDto(BaseModel):
    """Structured backtest experiment metrics returned to the caller."""
    experiment_id: str = Field(..., description="Unique experiment run identifier.")
    strategy_id: str = Field(..., description="Quantitative strategy used.")
    total_return_pct: float = Field(
        ..., description="Total percentage return over the backtest horizon."
    )
    annualized_return_pct: float = Field(
        ..., description="Annualized return percentage (252-day year)."
    )
    benchmark_return_pct: float = Field(
        ..., description="Equal-weighted benchmark return over same horizon."
    )
    sharpe_ratio: float = Field(
        ..., description="Sharpe ratio (risk-adjusted return, risk-free = 2% annual)."
    )
    sortino_ratio: float = Field(
        ..., description="Sortino ratio (downside deviation–adjusted)."
    )
    max_drawdown_pct: float = Field(
        ..., description="Maximum drawdown percentage from peak equity."
    )
    win_rate_pct: float = Field(
        ..., description="Percentage of trades that resulted in positive return."
    )
    profit_factor: float = Field(
        ..., description="Gross winning trade total / gross losing trade total."
    )
    execution_time_ms: float = Field(
        ..., description="Total backtest execution time in milliseconds."
    )
    equity_curve: List[Dict[str, Any]] = Field(
        ..., description="Time-series of equity values per date."
    )
    commission_bps: float = Field(..., description="Commission cost deducted in bps.")
    slippage_bps: float = Field(..., description="Slippage cost deducted in bps.")


class AvailableStrategiesResponseDto(BaseModel):
    """Response payload listing all supported quantitative strategies."""
    strategies: List[QuantStrategyDto]
    total_count: int