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
from app.api.v1.read_services import router as read_services_router
from app.api.v1.system_portable import router as system_portable_router
from app.api.v1.brokerage import router as brokerage_router

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(assistant_router)
api_v1_router.include_router(audit_router)
api_v1_router.include_router(approvals_router)
api_v1_router.include_router(ledger_router)
api_v1_router.include_router(quant_router)
api_v1_router.include_router(market_intelligence_router)
api_v1_router.include_router(read_services_router)
api_v1_router.include_router(system_portable_router)
api_v1_router.include_router(brokerage_router)
