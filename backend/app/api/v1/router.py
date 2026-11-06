"""
O-Finance API v1 Central Router
"""

from fastapi import APIRouter
from app.api.v1.assistant import router as assistant_router
from app.api.v1.audit import router as audit_router
from app.api.v1.approvals import router as approvals_router
from app.api.v1.ledger import router as ledger_router
from app.api.v1.quant import router as quant_router
from app.api.v1.market_intelligence import router as market_intelligence_router

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(assistant_router)
api_v1_router.include_router(audit_router)
api_v1_router.include_router(approvals_router)
api_v1_router.include_router(ledger_router)
api_v1_router.include_router(quant_router)
api_v1_router.include_router(market_intelligence_router)
