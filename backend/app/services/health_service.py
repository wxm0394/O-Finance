"""
O-Finance Health Check Service
Performs real diagnostics on API, database, and model credentials.
"""

from datetime import datetime, timezone
from app.core.config import settings
from app.core.database import check_database_connection
from app.schemas.health import HealthCheckDto, SubsystemStatusDto


class HealthService:
    """Evaluates health across all core subsystems without falsification."""

    @classmethod
    async def get_health_status(cls) -> HealthCheckDto:
        # 1. Database Check (real SELECT 1 probe)
        db_reachable, db_detail = await check_database_connection()
        if not settings.is_database_configured:
            db_status = "unconfigured"
        elif db_reachable:
            db_status = "healthy"
        else:
            db_status = "unreachable"

        db_subsystem = SubsystemStatusDto(
            status=db_status,
            configured=settings.is_database_configured,
            reachable=db_reachable,
            detail=db_detail,
        )

        # 2. AI Credential Check (Presence check only; cannot claim model verified)
        key_configured = settings.is_gemini_key_configured
        ai_subsystem = SubsystemStatusDto(
            status="healthy" if key_configured else "unconfigured",
            configured=key_configured,
            reachable=False,  # Phase 2.1: No live probe call executed
            detail=(
                "GEMINI_API_KEY is present in backend environment (Unverified with live API)"
                if key_configured
                else "GEMINI_API_KEY is not set in backend/.env"
            ),
        )

        # 3. Overall System Status
        if db_status == "unreachable":
            overall_status = "unhealthy"
        elif db_status == "unconfigured" or not key_configured:
            overall_status = "degraded"
        else:
            overall_status = "healthy"

        return HealthCheckDto(
            status=overall_status,
            timestamp=datetime.now(timezone.utc).isoformat(),
            api_service_alive=True,
            app_env=settings.app_env,
            subsystems={
                "postgresql": db_subsystem,
                "gemini_credential": ai_subsystem,
            },
        )
