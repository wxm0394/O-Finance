"""
O-Finance Database Layer (SQLAlchemy 2.x + psycopg 3)
Provides asynchronous engine, session factory, declarative base,
and explicit database connectivity verification.
"""

from typing import AsyncGenerator, Optional, Tuple
import asyncio
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = logging.getLogger("ofinance.database")


class Base(DeclarativeBase):
    """Declarative Base for all PostgreSQL transactional and audit models."""
    pass


# Global engine and sessionmaker references
_async_engine: Optional[AsyncEngine] = None
_async_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def get_engine() -> Optional[AsyncEngine]:
    """
    Lazily initialize and return the async SQLAlchemy engine.
    Returns None if DATABASE_URL is not configured.
    """
    global _async_engine, _async_session_factory

    if not settings.is_database_configured:
        return None

    if _async_engine is None and settings.database_url:
        try:
            # Ensure URL uses postgresql+psycopg for psycopg 3 async driver
            db_url = settings.database_url
            if db_url.startswith("postgresql://"):
                db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

            _async_engine = create_async_engine(
                db_url,
                echo=settings.app_env == "development" and settings.log_level == "DEBUG",
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=10,
            )
            _async_session_factory = async_sessionmaker(
                bind=_async_engine,
                autoflush=False,
                expire_on_commit=False,
            )
            logger.info("Initialized async SQLAlchemy engine with psycopg 3 driver.")
        except Exception as e:
            logger.error("Failed to construct async SQLAlchemy engine: %s", str(e))
            _async_engine = None
            _async_session_factory = None

    return _async_engine


def get_session_factory() -> Optional[async_sessionmaker[AsyncSession]]:
    """Return the async session factory if engine is available."""
    get_engine()
    return _async_session_factory


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields an async database session.
    Raises ConnectionError if database is not configured or engine unavailable.
    """
    factory = get_session_factory()
    if factory is None:
        raise ConnectionError(
            "PostgreSQL is not configured or engine is unavailable. Check DATABASE_URL in backend/.env."
        )

    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_database_connection(timeout_seconds: float = 2.0) -> Tuple[bool, str]:
    """
    Executes a real ping (SELECT 1) against the database with strict timeout.
    Returns (is_connected, status_detail).
    NEVER reports success if database is unconfigured or unreachable.
    """
    if not settings.is_database_configured:
        return False, "DATABASE_URL is not configured (Empty / None)"

    engine = get_engine()
    if engine is None:
        return False, "Async engine failed to initialize from DATABASE_URL"

    async def _ping_db() -> int:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            return result.scalar()

    try:
        val = await asyncio.wait_for(_ping_db(), timeout=timeout_seconds)
        if val == 1:
            return True, "PostgreSQL reachable (SELECT 1 successful)"
        return False, f"Unexpected query response from database: {val}"
    except asyncio.TimeoutError:
        logger.warning(
            "Database connectivity check timed out after %.1fs", timeout_seconds
        )
        return False, f"PostgreSQL connection timed out after {timeout_seconds:.1f}s"
    except Exception as e:
        logger.warning("Database connectivity check failed: %s", str(e))
        return False, f"PostgreSQL connection error: {type(e).__name__}"
