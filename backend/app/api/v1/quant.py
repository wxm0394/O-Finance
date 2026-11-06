"""
O-Finance Quantitative Backtest API Endpoints (/api/v1/quant)
Provides parameterized deterministic backtest execution and strategy metadata
via DuckDB + Parquet analytical engine with synthetic data fallback.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.security import SecurityGuard
from app.schemas.quant import (
    BacktestRequestDto,
    BacktestResultDto,
    AvailableStrategiesResponseDto,
    QuantStrategyDto,
)
from app.services.audit_service import AuditService
from app.quant.backtest_engine import (
    run_parameterized_backtest,
    get_available_strategies,
)

router = APIRouter(prefix="/quant", tags=["Quantitative Backtest"])


@router.get(
    "/strategies",
    response_model=AvailableStrategiesResponseDto,
    summary="Get Available Quantitative Strategies",
    description="Returns metadata for all supported quantitative trading strategies.",
)
async def get_quant_strategies() -> AvailableStrategiesResponseDto:
    strategies = get_available_strategies()
    quant_dtos = [
        QuantStrategyDto(
            id=s["id"],
            name=s["name"],
            category=s["category"],
            description=s["description"],
            default_parameters=s["default_parameters"],
        )
        for s in strategies
    ]
    return AvailableStrategiesResponseDto(
        strategies=quant_dtos,
        total_count=len(strategies),
    )


@router.post(
    "/backtest",
    response_model=BacktestResultDto,
    summary="Execute Parameterized Backtest",
    description="Runs a parameterized quantitative backtest across specified symbols and date range. "
    "Deducts bilateral friction costs (commission_bps + slippage_bps) per trade. "
    "Records audit log entry via AuditService. Falls back to synthetic OHLCV data if DuckDB/Parquet unavailable.",
)
async def execute_backtest(
    payload: BacktestRequestDto,
    session: AsyncSession = Depends(get_db_session),
) -> BacktestResultDto:
    # Security: validate operator permissions via SecurityGuard
    SecurityGuard.check_task_mode_permission(
        task_mode="quantitative_research",
        tool_name="run_strategy_backtest",
    )

    # Execute backtest
    result = run_parameterized_backtest(
        strategy_id=payload.strategy_id,
        symbols=payload.symbols,
        start_date=payload.start_date,
        end_date=payload.end_date,
        initial_capital=payload.initial_capital,
        commission_bps=payload.commission_bps,
        slippage_bps=payload.slippage_bps,
        parameters=payload.parameters,
    )

    # Record audit log entry
    await AuditService.append_entry(
        session=session,
        category="Quantitative Backtest",
        actor="Local Operator",
        action="execute_backtest",
        target=result["experiment_id"],
        severity="INFO",
        details={
            "strategy_id": payload.strategy_id,
            "symbols": payload.symbols,
            "start_date": payload.start_date,
            "end_date": payload.end_date,
            "initial_capital": payload.initial_capital,
            "commission_bps": payload.commission_bps,
            "slippage_bps": payload.slippage_bps,
        },
    )

    # Commit session to persist audit entry
    await session.commit()

    # Return structured result DTO
    return BacktestResultDto(
        experiment_id=result["experiment_id"],
        strategy_id=result["strategy_id"],
        total_return_pct=result["total_return_pct"],
        annualized_return_pct=result["annualized_return_pct"],
        benchmark_return_pct=result["benchmark_return_pct"],
        sharpe_ratio=result["sharpe_ratio"],
        sortino_ratio=result["sortino_ratio"],
        max_drawdown_pct=result["max_drawdown_pct"],
        win_rate_pct=result["win_rate_pct"],
        profit_factor=result["profit_factor"],
        execution_time_ms=result["execution_time_ms"],
        equity_curve=result["equity_curve"],
        commission_bps=result["commission_bps"],
        slippage_bps=result["slippage_bps"],
    )