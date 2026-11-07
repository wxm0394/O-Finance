"""
O-Finance Brokerage API v1 Endpoints
Manages IBKR Client Portal Gateway (:5055) control, Schwab OAuth authentication,
credential configuration with masking, read-only position sync, and HITL order staging/execution.
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors.brokerage_manager import (
    brokerage_manager,
    execute_approved_brokerage_order,
    stage_brokerage_order_intent,
)
from app.core.database import get_db_session
from app.services.audit_service import AuditService

router = APIRouter(prefix="/brokerage", tags=["brokerage"])


class GatewayControlRequest(BaseModel):
    action: str = Field(
        ..., description="Action to perform: 'start', 'stop', 'tickle', or 'sso_auth'"
    )


class BrokerageConfigRequest(BaseModel):
    ibkr: Optional[Dict[str, str]] = Field(
        default=None,
        description="IBKR configuration (gateway_url, flex_token, flex_query_id, account_id)",
    )
    schwab: Optional[Dict[str, str]] = Field(
        default=None,
        description="Charles Schwab configuration (app_key, app_secret, callback_url, account_id)",
    )


class StageOrderRequest(BaseModel):
    broker: str = Field(..., description="'ibkr' or 'schwab'")
    account_id: str = Field(..., description="Account identifier")
    symbol: str = Field(..., description="Ticker symbol (e.g., NVDA, VOO)")
    side: str = Field(..., description="'BUY' or 'SELL'")
    quantity: float = Field(..., gt=0, description="Order quantity")
    order_type: str = Field(default="LIMIT", description="'LIMIT' or 'MARKET'")
    limit_price: Optional[float] = Field(default=None, description="Limit price in USD")
    dry_run: bool = Field(default=True, description="What-if simulation flag")


class ExecuteApprovedOrderRequest(BaseModel):
    approval_id: str = Field(..., description="Approved approval task ID (APR-*)")
    order_payload: Dict[str, Any] = Field(
        ..., description="Order payload matching the original staged proposal hash"
    )


@router.get("/status")
async def get_brokerage_status():
    """
    Returns IBKR gateway running status, port (5055), authentication state,
    Schwab OAuth state, masked credential details, and recent 100 console logs.
    """
    status_data = brokerage_manager.get_status()
    # Limit console logs in status response to last 100 lines for frontend terminal box
    status_data["console_logs"] = status_data["console_logs"][-100:]
    return status_data


@router.post("/gateway/control")
async def control_brokerage_gateway(payload: GatewayControlRequest):
    """
    Background control of IBKR Gateway process: 'start', 'stop', 'tickle', or 'sso_auth'.
    """
    action = payload.action.lower().strip()
    if action == "start":
        res = await brokerage_manager.start_gateway()
        return res
    elif action == "stop":
        res = await brokerage_manager.stop_gateway()
        return res
    elif action == "tickle":
        res = await brokerage_manager.tickle_keepalive()
        return res
    elif action == "sso_auth":
        brokerage_manager.log(
            "[IBKR Gateway] SSO Login window request received. Gateway SSL active on https://127.0.0.1:5055."
        )
        return {
            "status": brokerage_manager.status,
            "sso_url": "https://127.0.0.1:5055",
            "message": "IBKR Gateway SSO Auth ready.",
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown gateway control action: '{payload.action}'. Expected 'start', 'stop', 'tickle', or 'sso_auth'.",
        )


@router.post("/config")
async def configure_brokerage_credentials(
    payload: BrokerageConfigRequest,
    session: AsyncSession = Depends(get_db_session),
):
    """
    Write-Only endpoint to configure IBKR Flex / Gateway or Schwab OAuth credentials.
    Returns masked response and logs audit record.
    """
    updated_status = brokerage_manager.update_config(
        ibkr_data=payload.ibkr,
        schwab_data=payload.schwab,
    )

    await AuditService.append_entry(
        session=session,
        category="Brokerage Config",
        actor="Local Operator",
        action="UPDATE_BROKERAGE_CONFIG",
        target="brokerage:credentials",
        severity="NOTICE",
        details={
            "ibkr_updated": bool(payload.ibkr),
            "schwab_updated": bool(payload.schwab),
        },
    )

    updated_status["console_logs"] = updated_status["console_logs"][-100:]
    return updated_status


@router.get("/schwab/auth-url")
async def get_schwab_auth_url():
    """Returns Charles Schwab OAuth 2.0 authorization URL."""
    url = brokerage_manager.get_schwab_auth_url()
    return {"auth_url": url}


@router.get("/schwab/callback")
async def schwab_oauth_callback(
    code: str = Query(..., description="OAuth 2.0 authorization code"),
    session: AsyncSession = Depends(get_db_session),
):
    """Handles Charles Schwab OAuth 2.0 callback code exchange."""
    res = brokerage_manager.handle_schwab_oauth_callback(code)

    await AuditService.append_entry(
        session=session,
        category="Brokerage OAuth",
        actor="Local Operator",
        action="SCHWAB_OAUTH_CALLBACK",
        target="brokerage:schwab",
        severity="INFO",
        details={"oauth_status": res["status"]},
    )

    return res


@router.get("/positions")
async def sync_positions(broker: str = Query(default="ibkr")):
    """Read-only extraction of brokerage positions and balances."""
    try:
        data = await brokerage_manager.sync_brokerage_positions_and_transactions(
            broker
        )
        return data
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/orders/stage")
async def stage_order(
    payload: StageOrderRequest,
    session: AsyncSession = Depends(get_db_session),
):
    """
    Submits a draft brokerage order intent to Approval Inbox.
    Creates a PENDING approval task (APR-*). Never places live order directly!
    """
    try:
        res = await stage_brokerage_order_intent(
            session=session,
            broker=payload.broker,
            account_id=payload.account_id,
            symbol=payload.symbol,
            side=payload.side,
            quantity=payload.quantity,
            order_type=payload.order_type,
            limit_price=payload.limit_price,
            dry_run=payload.dry_run,
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/orders/execute-approved")
async def execute_approved_order(
    payload: ExecuteApprovedOrderRequest,
    session: AsyncSession = Depends(get_db_session),
):
    """
    Executes a previously approved order by verifying and consuming the database approval token.
    Atomically appends double-entry security trade settlement to Beancount ledger.
    """
    try:
        res = await execute_approved_brokerage_order(
            session=session,
            approval_id=payload.approval_id,
            order_payload=payload.order_payload,
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
