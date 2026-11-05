"""
O-Finance Health Check Service (P2.1.2)
Performs diagnostics on API, database, and model credentials.
Strict Semantic Definitions:
- 'configured': ONLY indicates that the configuration (key / URL) exists.
- 'reachable': ONLY indicates that an actual network connection probe succeeded.
- 'gemini_api_key': Key presence does NOT equal valid key, nor does it mean reachable.
  Therefore, reachable=False until a live probe succeeds in Phase 2.2.
- 'gemini_model': Unverified and unreachable until actual inference probe succeeds.
- 'ollama': Tested via real HTTP ping to ollama_base_url.
"""

from datetime import datetime, timezone
import httpx
from app.core.config import settings
from app.core.database import check_database_connection
from app.schemas.health import HealthCheckDto, SubsystemStatusDto


class HealthService:
    """Evaluates health across all core subsystems without falsification."""

    @classmethod
    async def get_health_status(cls) -> HealthCheckDto:
        # 1. Database Check (real SELECT 1 probe with strict timeout)
        db_reachable, db_detail = await check_database_connection(timeout_seconds=2.0)
        if not settings.is_database_configured:
            db_status = "unconfigured"
        elif db_reachable:
            db_status = "healthy"
        else:
            db_status = "unreachable"

        postgres_subsystem = SubsystemStatusDto(
            status=db_status,
            configured=settings.is_database_configured,
            reachable=db_reachable,
            detail=db_detail,
        )

        # 2. Gemini Subsystems
        is_gemini_active = settings.llm_provider == "Gemini"
        gemini_key_configured = settings.is_gemini_key_configured if is_gemini_active else False

        # Configured only indicates presence in backend environment; reachable=False until live probe
        gemini_key_subsystem = SubsystemStatusDto(
            status="healthy" if gemini_key_configured else "unconfigured",
            configured=gemini_key_configured,
            reachable=False,  # Strict semantics: presence != live probe verification
            detail=(
                "GEMINI_API_KEY present in backend environment (Unverified with live cloud API probe)"
                if gemini_key_configured
                else (
                    "GEMINI_API_KEY is not set in backend/.env"
                    if is_gemini_active
                    else "Not applicable (Local Ollama mode active)"
                )
            ),
        )

        # Model verification: Key presence does NOT equal model verification!
        # In Phase 2.1.2, no live LLM completion tokens are billed; model probe is pending P2.2
        gemini_model_subsystem = SubsystemStatusDto(
            status="degraded" if gemini_key_configured else "unconfigured",
            configured=gemini_key_configured,
            reachable=False,  # Unreachable / unverified until live probe succeeds
            detail=(
                "Key configured, but live model endpoint unverified (Probe pending in Phase 2.2)"
                if gemini_key_configured
                else (
                    "Gemini model unconfigured (API Key missing)"
                    if is_gemini_active
                    else "Not applicable (Local Ollama mode active)"
                )
            ),
        )

        # 3. Local Ollama Subsystem (Real HTTP probe)
        is_ollama_active = settings.llm_provider == "Local Ollama"
        ollama_reachable = False
        ollama_detail = "Not applicable (Gemini provider active)"

        if is_ollama_active:
            try:
                # Real HTTP ping to local Ollama daemon
                async with httpx.AsyncClient(timeout=1.0) as client:
                    resp = await client.get(f"{settings.ollama_base_url}/api/tags")
                    if resp.status_code == 200:
                        ollama_reachable = True
                        ollama_detail = f"Local Ollama daemon reachable at {settings.ollama_base_url}"
                    else:
                        ollama_detail = f"Local Ollama returned HTTP {resp.status_code}"
            except Exception as e:
                ollama_detail = f"Local Ollama connection failed: {type(e).__name__}"

        ollama_subsystem = SubsystemStatusDto(
            status=(
                "healthy"
                if (is_ollama_active and ollama_reachable)
                else ("unreachable" if is_ollama_active else "unconfigured")
            ),
            configured=is_ollama_active,
            reachable=ollama_reachable,
            detail=ollama_detail,
        )

        # 4. Overall System Status Determination
        if db_status == "unreachable":
            overall_status = "unhealthy"
        elif is_ollama_active and not ollama_reachable:
            overall_status = "unhealthy"
        elif (
            db_status == "unconfigured"
            or (is_gemini_active and not gemini_key_configured)
            or (is_gemini_active and not gemini_model_subsystem.reachable)
        ):
            overall_status = "degraded"
        else:
            overall_status = "healthy"

        return HealthCheckDto(
            status=overall_status,
            timestamp=datetime.now(timezone.utc).isoformat(),
            api_service_alive=True,
            app_env=settings.app_env,
            active_llm_provider=settings.llm_provider,
            subsystems={
                "postgres": postgres_subsystem,
                "gemini_api_key": gemini_key_subsystem,
                "gemini_model": gemini_model_subsystem,
                "ollama": ollama_subsystem,
            },
        )
